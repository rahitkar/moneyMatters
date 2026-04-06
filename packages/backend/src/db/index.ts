import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = './data/money-matters.db';

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
export const sqlite: DatabaseType = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Initialize database tables
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      isin TEXT,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      provider TEXT NOT NULL,
      current_price REAL,
      currency TEXT DEFAULT 'USD',
      last_updated INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      purchase_price REAL NOT NULL,
      purchase_date TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (asset_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      recorded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      fees REAL DEFAULT 0,
      transaction_date TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL UNIQUE,
      total_value REAL NOT NULL,
      total_cost REAL NOT NULL,
      realized_gains REAL DEFAULT 0,
      allocation_breakdown TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benchmark_prices (
      id TEXT PRIMARY KEY,
      benchmark_id TEXT NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      recorded_date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS realized_gains (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      sell_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      buy_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      cost_basis REAL NOT NULL,
      sale_proceeds REAL NOT NULL,
      gain REAL NOT NULL,
      gain_percent REAL NOT NULL,
      realized_date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_holdings_asset_id ON holdings(asset_id);
    CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
    CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_asset_id ON price_history(asset_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions(asset_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_benchmark_prices_benchmark_id ON benchmark_prices(benchmark_id);
    CREATE INDEX IF NOT EXISTS idx_benchmark_prices_date ON benchmark_prices(recorded_date);
    CREATE INDEX IF NOT EXISTS idx_realized_gains_asset_id ON realized_gains(asset_id);

    CREATE TABLE IF NOT EXISTS cash_flow_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tag TEXT,
      default_budget REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_flow_entries (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES cash_flow_categories(id) ON DELETE CASCADE,
      entry_month TEXT NOT NULL,
      budget REAL DEFAULT 0,
      actual REAL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_income (
      id TEXT PRIMARY KEY,
      entry_month TEXT NOT NULL UNIQUE,
      salary REAL NOT NULL DEFAULT 0,
      other_income REAL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_targets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      starting_value REAL NOT NULL,
      monthly_investment REAL NOT NULL,
      yearly_return_rate REAL NOT NULL,
      stretch_monthly_investment REAL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fire_simulations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_age INTEGER NOT NULL,
      retirement_age INTEGER NOT NULL,
      life_expectancy INTEGER NOT NULL,
      current_savings REAL NOT NULL,
      monthly_saving REAL NOT NULL,
      annual_savings_increase REAL NOT NULL,
      return_on_investment REAL NOT NULL,
      capital_gain_tax REAL NOT NULL,
      post_retirement_monthly_expense REAL NOT NULL,
      inflation_rate REAL NOT NULL,
      start_year INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cf_entries_month ON cash_flow_entries(entry_month);
    CREATE INDEX IF NOT EXISTS idx_cf_entries_category ON cash_flow_entries(category_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_income_month ON monthly_income(entry_month);

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_flow_spends (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES cash_flow_categories(id) ON DELETE CASCADE,
      payment_method_id TEXT NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      description TEXT,
      spend_date TEXT NOT NULL,
      entry_month TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cf_spends_month ON cash_flow_spends(entry_month);
    CREATE INDEX IF NOT EXISTS idx_cf_spends_category ON cash_flow_spends(category_id);
    CREATE INDEX IF NOT EXISTS idx_cf_spends_payment ON cash_flow_spends(payment_method_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('cycleStartDay', '1');
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('dob', '1998-09-09');
  `);

  // Migrate monthly_income: add target + balance columns
  const miCols = sqlite.prepare(`PRAGMA table_info(monthly_income)`).all() as { name: string }[];
  if (!miCols.some((c) => c.name === 'expense_limit')) {
    sqlite.exec(`ALTER TABLE monthly_income ADD COLUMN expense_limit REAL`);
  }
  if (!miCols.some((c) => c.name === 'investment_target')) {
    sqlite.exec(`ALTER TABLE monthly_income ADD COLUMN investment_target REAL`);
  }
  if (!miCols.some((c) => c.name === 'savings_target')) {
    sqlite.exec(`ALTER TABLE monthly_income ADD COLUMN savings_target REAL`);
  }
  if (!miCols.some((c) => c.name === 'opening_balance')) {
    sqlite.exec(`ALTER TABLE monthly_income ADD COLUMN opening_balance REAL`);
  }

  // Migrate transactions: add fund_source_id
  const txCols = sqlite.prepare(`PRAGMA table_info(transactions)`).all() as { name: string }[];
  if (!txCols.some((c) => c.name === 'fund_source_id')) {
    sqlite.exec(`ALTER TABLE transactions ADD COLUMN fund_source_id TEXT REFERENCES assets(id) ON DELETE SET NULL`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_fund_source ON transactions(fund_source_id)`);
  }

  const assetCols = sqlite.prepare(`PRAGMA table_info(assets)`).all() as { name: string }[];
  if (!assetCols.some((c) => c.name === 'isin')) {
    sqlite.exec(`ALTER TABLE assets ADD COLUMN isin TEXT`);
  }
  if (!assetCols.some((c) => c.name === 'interest_rate')) {
    sqlite.exec(`ALTER TABLE assets ADD COLUMN interest_rate REAL`);
  }
  if (!assetCols.some((c) => c.name === 'maturity_date')) {
    sqlite.exec(`ALTER TABLE assets ADD COLUMN maturity_date TEXT`);
  }
  if (!assetCols.some((c) => c.name === 'institution')) {
    sqlite.exec(`ALTER TABLE assets ADD COLUMN institution TEXT`);
  }

  // Migrate: convert legacy salary data to income spends
  migrateSalaryToIncomeSpends();

  // Ensure default categories exist
  ensureDefaultCategories();

  // Seed default benchmarks
  seedBenchmarks();
  
  console.log('Database initialized successfully');
}

function ensureDefaultCategories() {
  const defaults = [
    { name: 'Discounts & Waivers', type: 'expense', tag: 'need', sortOrder: 99 },
  ];
  for (const cat of defaults) {
    const exists = sqlite.prepare(
      `SELECT id FROM cash_flow_categories WHERE name = ? AND type = ? LIMIT 1`
    ).get(cat.name, cat.type) as { id: string } | undefined;
    if (!exists) {
      sqlite.prepare(
        `INSERT INTO cash_flow_categories (id, name, type, tag, default_budget, sort_order, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).run(`cat_${cat.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`, cat.name, cat.type, cat.tag, cat.sortOrder, Date.now());
    }
  }
}

// Seed default benchmark indices
function seedBenchmarks() {
  const defaultBenchmarks = [
    { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
    { symbol: '^IXIC', name: 'NASDAQ Composite', region: 'US' },
    { symbol: '^DJI', name: 'Dow Jones Industrial Average', region: 'US' },
    { symbol: '^FTSE', name: 'FTSE 100', region: 'UK' },
    { symbol: '^N225', name: 'Nikkei 225', region: 'Japan' },
    { symbol: '^GDAXI', name: 'DAX', region: 'Germany' },
    { symbol: '^NSEI', name: 'Nifty 50', region: 'India' },
    { symbol: '^BSESN', name: 'BSE Sensex', region: 'India' },
    { symbol: 'NIFTYMIDCAP150.NS', name: 'Nifty Midcap 150', region: 'India' },
    { symbol: 'HDFCSML250.NS', name: 'Nifty Smallcap 250', region: 'India' },
  ];

  const stmt = sqlite.prepare(`
    INSERT OR IGNORE INTO benchmarks (id, symbol, name, region, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  const now = Date.now();
  for (const benchmark of defaultBenchmarks) {
    stmt.run(
      `benchmark_${benchmark.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`,
      benchmark.symbol,
      benchmark.name,
      benchmark.region,
      now
    );
  }
}

function migrateSalaryToIncomeSpends() {
  // Ensure a "Salary" income category exists
  const existingSalaryCat = sqlite.prepare(
    `SELECT id FROM cash_flow_categories WHERE name = 'Salary' AND type = 'income' LIMIT 1`
  ).get() as { id: string } | undefined;

  let salaryCatId: string;
  if (existingSalaryCat) {
    salaryCatId = existingSalaryCat.id;
  } else {
    salaryCatId = `cat_salary_${Date.now()}`;
    sqlite.prepare(
      `INSERT OR IGNORE INTO cash_flow_categories (id, name, type, tag, default_budget, sort_order, created_at)
       VALUES (?, 'Salary', 'income', NULL, 0, 0, ?)`
    ).run(salaryCatId, Date.now());
  }

  // Ensure an "Other Income" category exists
  const existingOtherCat = sqlite.prepare(
    `SELECT id FROM cash_flow_categories WHERE name = 'Other Income' AND type = 'income' LIMIT 1`
  ).get() as { id: string } | undefined;

  let otherIncomeCatId: string;
  if (existingOtherCat) {
    otherIncomeCatId = existingOtherCat.id;
  } else {
    otherIncomeCatId = `cat_other_inc_${Date.now()}`;
    sqlite.prepare(
      `INSERT OR IGNORE INTO cash_flow_categories (id, name, type, tag, default_budget, sort_order, created_at)
       VALUES (?, 'Other Income', 'income', NULL, 0, 1, ?)`
    ).run(otherIncomeCatId, Date.now());
  }

  // Need a payment method for income spends; use bank_transfer or create one
  let pmId: string;
  const existingPM = sqlite.prepare(
    `SELECT id FROM payment_methods WHERE type = 'bank_transfer' LIMIT 1`
  ).get() as { id: string } | undefined;
  if (existingPM) {
    pmId = existingPM.id;
  } else {
    pmId = `pm_bank_${Date.now()}`;
    sqlite.prepare(
      `INSERT OR IGNORE INTO payment_methods (id, name, type, is_active, created_at)
       VALUES (?, 'Bank Transfer', 'bank_transfer', 1, ?)`
    ).run(pmId, Date.now());
  }

  // Check if migration already ran (flag in app_settings)
  const migrated = sqlite.prepare(
    `SELECT value FROM app_settings WHERE key = 'salary_migration_done'`
  ).get() as { value: string } | undefined;
  if (migrated) return;

  // Convert each monthlyIncome row with salary > 0 to an income spend
  const incomeRows = sqlite.prepare(
    `SELECT entry_month, salary, other_income FROM monthly_income WHERE salary > 0`
  ).all() as { entry_month: string; salary: number; other_income: number | null }[];

  const now = Date.now();
  const insertSpend = sqlite.prepare(
    `INSERT INTO cash_flow_spends (id, category_id, payment_method_id, amount, description, spend_date, entry_month, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'income', ?)`
  );

  for (const row of incomeRows) {
    // Salary spend: date = 25th of the month
    const spendDate = `${row.entry_month}-25`;
    const spendId = `mig_sal_${row.entry_month}_${Date.now()}`;
    insertSpend.run(spendId, salaryCatId, pmId, row.salary, 'Salary (migrated)', spendDate, row.entry_month, now);

    if (row.other_income && row.other_income > 0) {
      const otherSpendId = `mig_oth_${row.entry_month}_${Date.now()}`;
      insertSpend.run(otherSpendId, otherIncomeCatId, pmId, row.other_income, 'Other income (migrated)', spendDate, row.entry_month, now);
    }
  }

  // Mark migration as done
  sqlite.prepare(
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('salary_migration_done', '1')`
  ).run();
}

export { schema };
