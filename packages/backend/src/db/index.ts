import Database from 'better-sqlite3';
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
const sqlite = new Database(DB_PATH);
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
  `);

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

  // Seed default benchmarks
  seedBenchmarks();
  
  console.log('Database initialized successfully');
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
    { symbol: 'NIFTYSMLCAP250.NS', name: 'Nifty Smallcap 250', region: 'India' },
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

export { schema };
