/**
 * One-time migration script: SQLite → Supabase Postgres
 *
 * Usage:
 *   DATABASE_URL=postgresql://... tsx src/scripts/migrate-sqlite-to-postgres.ts [path-to-sqlite.db]
 *
 * Defaults to ./data/money-matters.db if no path is given.
 */
import Database from 'better-sqlite3';
import pgClient from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';

const SQLITE_PATH = process.argv[2] || './data/money-matters.db';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL env var is required');
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pg = pgClient(DATABASE_URL);
const db = drizzle(pg, { schema });

function toDate(epoch: number | null): Date | null {
  if (epoch == null) return null;
  if (epoch > 9_999_999_999) return new Date(epoch);
  return new Date(epoch * 1000);
}

function toDateNonNull(epoch: number): Date {
  return toDate(epoch) ?? new Date();
}

async function migrate() {
  console.log(`Reading from SQLite: ${SQLITE_PATH}`);

  // 1. Users
  const usersRows = sqlite.prepare('SELECT * FROM users').all() as any[];
  if (usersRows.length) {
    console.log(`Migrating ${usersRows.length} users...`);
    for (const u of usersRows) {
      await db.insert(schema.users).values({
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: u.password_hash,
        createdAt: toDateNonNull(u.created_at),
      }).onConflictDoNothing();
    }
  }

  // 2. Assets
  const assetsRows = sqlite.prepare('SELECT * FROM assets').all() as any[];
  if (assetsRows.length) {
    console.log(`Migrating ${assetsRows.length} assets...`);
    for (const a of assetsRows) {
      await db.insert(schema.assets).values({
        id: a.id,
        userId: a.user_id,
        symbol: a.symbol,
        isin: a.isin,
        name: a.name,
        assetClass: a.asset_class,
        provider: a.provider,
        currentPrice: a.current_price,
        previousClose: a.previous_close,
        currency: a.currency,
        lastUpdated: toDate(a.last_updated),
        createdAt: toDateNonNull(a.created_at),
        interestRate: a.interest_rate,
        maturityDate: a.maturity_date,
        institution: a.institution,
      }).onConflictDoNothing();
    }
  }

  // 3. Holdings
  const holdingsRows = sqlite.prepare('SELECT * FROM holdings').all() as any[];
  if (holdingsRows.length) {
    console.log(`Migrating ${holdingsRows.length} holdings...`);
    for (const h of holdingsRows) {
      await db.insert(schema.holdings).values({
        id: h.id,
        assetId: h.asset_id,
        quantity: h.quantity,
        purchasePrice: h.purchase_price,
        purchaseDate: h.purchase_date,
        notes: h.notes,
        createdAt: toDateNonNull(h.created_at),
        updatedAt: toDateNonNull(h.updated_at),
      }).onConflictDoNothing();
    }
  }

  // 4. Tags
  const tagsRows = sqlite.prepare('SELECT * FROM tags').all() as any[];
  if (tagsRows.length) {
    console.log(`Migrating ${tagsRows.length} tags...`);
    for (const t of tagsRows) {
      await db.insert(schema.tags).values({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        color: t.color,
        description: t.description,
        createdAt: toDateNonNull(t.created_at),
      }).onConflictDoNothing();
    }
  }

  // 5. Asset Tags
  const assetTagsRows = sqlite.prepare('SELECT * FROM asset_tags').all() as any[];
  if (assetTagsRows.length) {
    console.log(`Migrating ${assetTagsRows.length} asset tags...`);
    for (const at of assetTagsRows) {
      await db.insert(schema.assetTags).values({
        assetId: at.asset_id,
        tagId: at.tag_id,
      }).onConflictDoNothing();
    }
  }

  // 6. Price History
  const priceHistoryRows = sqlite.prepare('SELECT * FROM price_history').all() as any[];
  if (priceHistoryRows.length) {
    console.log(`Migrating ${priceHistoryRows.length} price history records...`);
    const batchSize = 500;
    for (let i = 0; i < priceHistoryRows.length; i += batchSize) {
      const batch = priceHistoryRows.slice(i, i + batchSize).map((p: any) => ({
        id: p.id,
        assetId: p.asset_id,
        price: p.price,
        currency: p.currency,
        recordedAt: toDateNonNull(p.recorded_at),
      }));
      await db.insert(schema.priceHistory).values(batch).onConflictDoNothing();
      if (i % 5000 === 0 && i > 0) console.log(`  ... ${i} / ${priceHistoryRows.length}`);
    }
  }

  // 7. Transactions
  const transactionsRows = sqlite.prepare('SELECT * FROM transactions').all() as any[];
  if (transactionsRows.length) {
    console.log(`Migrating ${transactionsRows.length} transactions...`);
    for (const t of transactionsRows) {
      await db.insert(schema.transactions).values({
        id: t.id,
        assetId: t.asset_id,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        fees: t.fees,
        fundSourceId: t.fund_source_id,
        transactionDate: t.transaction_date,
        notes: t.notes,
        createdAt: toDateNonNull(t.created_at),
      }).onConflictDoNothing();
    }
  }

  // 8. Portfolio Snapshots
  const snapshotRows = sqlite.prepare('SELECT * FROM portfolio_snapshots').all() as any[];
  if (snapshotRows.length) {
    console.log(`Migrating ${snapshotRows.length} portfolio snapshots...`);
    for (const s of snapshotRows) {
      await db.insert(schema.portfolioSnapshots).values({
        id: s.id,
        userId: s.user_id,
        snapshotDate: s.snapshot_date,
        totalValue: s.total_value,
        totalCost: s.total_cost,
        realizedGains: s.realized_gains,
        allocationBreakdown: s.allocation_breakdown,
        createdAt: toDateNonNull(s.created_at),
      }).onConflictDoNothing();
    }
  }

  // 9. Benchmarks
  const benchmarkRows = sqlite.prepare('SELECT * FROM benchmarks').all() as any[];
  if (benchmarkRows.length) {
    console.log(`Migrating ${benchmarkRows.length} benchmarks...`);
    for (const b of benchmarkRows) {
      await db.insert(schema.benchmarks).values({
        id: b.id,
        symbol: b.symbol,
        name: b.name,
        region: b.region,
        isActive: b.is_active === 1,
        createdAt: toDateNonNull(b.created_at),
      }).onConflictDoNothing();
    }
  }

  // 10. Benchmark Prices
  const benchmarkPriceRows = sqlite.prepare('SELECT * FROM benchmark_prices').all() as any[];
  if (benchmarkPriceRows.length) {
    console.log(`Migrating ${benchmarkPriceRows.length} benchmark prices...`);
    const batchSize = 500;
    for (let i = 0; i < benchmarkPriceRows.length; i += batchSize) {
      const batch = benchmarkPriceRows.slice(i, i + batchSize).map((bp: any) => ({
        id: bp.id,
        benchmarkId: bp.benchmark_id,
        price: bp.price,
        recordedDate: bp.recorded_date,
        createdAt: toDateNonNull(bp.created_at),
      }));
      await db.insert(schema.benchmarkPrices).values(batch).onConflictDoNothing();
      if (i % 5000 === 0 && i > 0) console.log(`  ... ${i} / ${benchmarkPriceRows.length}`);
    }
  }

  // 11. Realized Gains
  const realizedGainsRows = sqlite.prepare('SELECT * FROM realized_gains').all() as any[];
  if (realizedGainsRows.length) {
    console.log(`Migrating ${realizedGainsRows.length} realized gains...`);
    for (const rg of realizedGainsRows) {
      await db.insert(schema.realizedGains).values({
        id: rg.id,
        assetId: rg.asset_id,
        sellTransactionId: rg.sell_transaction_id,
        buyTransactionId: rg.buy_transaction_id,
        quantity: rg.quantity,
        costBasis: rg.cost_basis,
        saleProceeds: rg.sale_proceeds,
        gain: rg.gain,
        gainPercent: rg.gain_percent,
        realizedDate: rg.realized_date,
        createdAt: toDateNonNull(rg.created_at),
      }).onConflictDoNothing();
    }
  }

  // 12. App Settings
  const appSettingsRows = sqlite.prepare('SELECT * FROM app_settings').all() as any[];
  if (appSettingsRows.length) {
    console.log(`Migrating ${appSettingsRows.length} app settings...`);
    for (const s of appSettingsRows) {
      await db.insert(schema.appSettings).values({
        key: s.key,
        userId: s.user_id,
        value: s.value,
      }).onConflictDoNothing();
    }
  }

  // 13. Cash Flow Categories
  const cfCatRows = sqlite.prepare('SELECT * FROM cash_flow_categories').all() as any[];
  if (cfCatRows.length) {
    console.log(`Migrating ${cfCatRows.length} cash flow categories...`);
    for (const c of cfCatRows) {
      await db.insert(schema.cashFlowCategories).values({
        id: c.id,
        userId: c.user_id,
        name: c.name,
        type: c.type,
        tag: c.tag,
        defaultBudget: c.default_budget,
        sortOrder: c.sort_order,
        createdAt: toDateNonNull(c.created_at),
      }).onConflictDoNothing();
    }
  }

  // 14. Cash Flow Entries
  const cfEntryRows = sqlite.prepare('SELECT * FROM cash_flow_entries').all() as any[];
  if (cfEntryRows.length) {
    console.log(`Migrating ${cfEntryRows.length} cash flow entries...`);
    for (const e of cfEntryRows) {
      await db.insert(schema.cashFlowEntries).values({
        id: e.id,
        categoryId: e.category_id,
        entryMonth: e.entry_month,
        budget: e.budget,
        actual: e.actual,
        notes: e.notes,
        createdAt: toDateNonNull(e.created_at),
      }).onConflictDoNothing();
    }
  }

  // 15. Monthly Income
  const miRows = sqlite.prepare('SELECT * FROM monthly_income').all() as any[];
  if (miRows.length) {
    console.log(`Migrating ${miRows.length} monthly income records...`);
    for (const m of miRows) {
      await db.insert(schema.monthlyIncome).values({
        id: m.id,
        userId: m.user_id,
        entryMonth: m.entry_month,
        salary: m.salary,
        otherIncome: m.other_income,
        openingBalance: m.opening_balance,
        expenseLimit: m.expense_limit,
        investmentTarget: m.investment_target,
        savingsTarget: m.savings_target,
        notes: m.notes,
        createdAt: toDateNonNull(m.created_at),
      }).onConflictDoNothing();
    }
  }

  // 16. Payment Methods
  const pmRows = sqlite.prepare('SELECT * FROM payment_methods').all() as any[];
  if (pmRows.length) {
    console.log(`Migrating ${pmRows.length} payment methods...`);
    for (const p of pmRows) {
      await db.insert(schema.paymentMethods).values({
        id: p.id,
        userId: p.user_id,
        name: p.name,
        type: p.type,
        isActive: p.is_active === 1,
        createdAt: toDateNonNull(p.created_at),
      }).onConflictDoNothing();
    }
  }

  // 17. Cash Flow Spends
  const cfsRows = sqlite.prepare('SELECT * FROM cash_flow_spends').all() as any[];
  if (cfsRows.length) {
    console.log(`Migrating ${cfsRows.length} cash flow spends...`);
    for (const s of cfsRows) {
      await db.insert(schema.cashFlowSpends).values({
        id: s.id,
        userId: s.user_id,
        categoryId: s.category_id,
        paymentMethodId: s.payment_method_id,
        amount: s.amount,
        description: s.description,
        spendDate: s.spend_date,
        entryMonth: s.entry_month,
        type: s.type,
        createdAt: toDateNonNull(s.created_at),
      }).onConflictDoNothing();
    }
  }

  // 18. Net Worth Targets
  const nwtRows = sqlite.prepare('SELECT * FROM net_worth_targets').all() as any[];
  if (nwtRows.length) {
    console.log(`Migrating ${nwtRows.length} net worth targets...`);
    for (const n of nwtRows) {
      await db.insert(schema.netWorthTargets).values({
        id: n.id,
        userId: n.user_id,
        name: n.name,
        startingValue: n.starting_value,
        monthlyInvestment: n.monthly_investment,
        yearlyReturnRate: n.yearly_return_rate,
        stretchMonthlyInvestment: n.stretch_monthly_investment,
        startDate: n.start_date,
        endDate: n.end_date,
        isActive: n.is_active === 1,
        createdAt: toDateNonNull(n.created_at),
      }).onConflictDoNothing();
    }
  }

  // 19. FIRE Simulations
  const fireRows = sqlite.prepare('SELECT * FROM fire_simulations').all() as any[];
  if (fireRows.length) {
    console.log(`Migrating ${fireRows.length} FIRE simulations...`);
    for (const f of fireRows) {
      await db.insert(schema.fireSimulations).values({
        id: f.id,
        userId: f.user_id,
        name: f.name,
        currentAge: f.current_age,
        retirementAge: f.retirement_age,
        lifeExpectancy: f.life_expectancy,
        currentSavings: f.current_savings,
        monthlySaving: f.monthly_saving,
        annualSavingsIncrease: f.annual_savings_increase,
        returnOnInvestment: f.return_on_investment,
        capitalGainTax: f.capital_gain_tax,
        postRetirementMonthlyExpense: f.post_retirement_monthly_expense,
        inflationRate: f.inflation_rate,
        startYear: f.start_year,
        isActive: f.is_active === 1,
        createdAt: toDateNonNull(f.created_at),
      }).onConflictDoNothing();
    }
  }

  console.log('\nMigration complete!');
  sqlite.close();
  await pg.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
