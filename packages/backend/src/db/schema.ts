import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// Asset classes enum values
export const ASSET_CLASSES = [
  'stocks',
  'etf',
  'mutual_fund',
  'mutual_fund_equity',
  'mutual_fund_debt',
  'crypto',
  'bonds',
  'real_estate',
  'vehicle',
  'gold',
  'gold_physical',
  'silver',
  'silver_physical',
  'metals',
  'ppf',
  'epf',
  'nps',
  'fixed_deposit',
  'lended',
  'cash',
  'external_portfolio',
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

// Market data providers
export const PROVIDERS = [
  'yahoo_finance',
  'coingecko',
  'metals_api',
  'manual',
] as const;

export type Provider = (typeof PROVIDERS)[number];

// Transaction types
export const TRANSACTION_TYPES = ['buy', 'sell'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Time intervals for performance
export const TIME_INTERVALS = ['1D', '5D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'ALL', 'CUSTOM'] as const;
export type TimeInterval = (typeof TIME_INTERVALS)[number];

// Assets table - stores unique assets (e.g., AAPL, BTC)
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  /** Indian mutual fund ISIN (INF…), when known — used to merge name variants and match broker holdings. */
  isin: text('isin'),
  name: text('name').notNull(),
  assetClass: text('asset_class').notNull().$type<AssetClass>(),
  provider: text('provider').notNull().$type<Provider>(),
  currentPrice: real('current_price'),
  currency: text('currency').default('USD'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  interestRate: real('interest_rate'),
  maturityDate: text('maturity_date'),
  institution: text('institution'),
});

// Holdings table - stores user's positions in assets
export const holdings = sqliteTable('holdings', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull(),
  purchasePrice: real('purchase_price').notNull(),
  purchaseDate: text('purchase_date').notNull(), // ISO date string
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tags table - user-defined tags for categorization
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6366f1'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Asset-Tags junction table
export const assetTags = sqliteTable('asset_tags', {
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
});

// Price history for tracking performance over time
export const priceHistory = sqliteTable('price_history', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  price: real('price').notNull(),
  currency: text('currency').default('USD'),
  recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
});

// Transactions table - stores buy/sell transactions
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<TransactionType>(),
  quantity: real('quantity').notNull(),
  price: real('price').notNull(),
  fees: real('fees').default(0),
  fundSourceId: text('fund_source_id').references(() => assets.id, { onDelete: 'set null' }),
  transactionDate: text('transaction_date').notNull(), // ISO date string
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Portfolio snapshots for historical performance tracking
export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id: text('id').primaryKey(),
  snapshotDate: text('snapshot_date').notNull().unique(),
  totalValue: real('total_value').notNull(),
  totalCost: real('total_cost').notNull(),
  realizedGains: real('realized_gains').default(0),
  allocationBreakdown: text('allocation_breakdown'), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Benchmark indices configuration
export const benchmarks = sqliteTable('benchmarks', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Benchmark price history
export const benchmarkPrices = sqliteTable('benchmark_prices', {
  id: text('id').primaryKey(),
  benchmarkId: text('benchmark_id')
    .notNull()
    .references(() => benchmarks.id, { onDelete: 'cascade' }),
  price: real('price').notNull(),
  recordedDate: text('recorded_date').notNull(), // ISO date string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Realized gains tracking (from FIFO matching)
export const realizedGains = sqliteTable('realized_gains', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  sellTransactionId: text('sell_transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  buyTransactionId: text('buy_transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull(),
  costBasis: real('cost_basis').notNull(),
  saleProceeds: real('sale_proceeds').notNull(),
  gain: real('gain').notNull(),
  gainPercent: real('gain_percent').notNull(),
  realizedDate: text('realized_date').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── App Settings ───────────────────────────────────────────────────

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ── Cash Flow ──────────────────────────────────────────────────────

export const CASH_FLOW_CATEGORY_TYPES = ['income', 'expense'] as const;
export type CashFlowCategoryType = (typeof CASH_FLOW_CATEGORY_TYPES)[number];

export const EXPENSE_TAGS = ['need', 'luxury'] as const;
export type ExpenseTag = (typeof EXPENSE_TAGS)[number];

export const cashFlowCategories = sqliteTable('cash_flow_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<CashFlowCategoryType>(),
  tag: text('tag').$type<ExpenseTag>(),
  defaultBudget: real('default_budget').default(0),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const cashFlowEntries = sqliteTable('cash_flow_entries', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => cashFlowCategories.id, { onDelete: 'cascade' }),
  entryMonth: text('entry_month').notNull(), // YYYY-MM
  budget: real('budget').default(0),
  actual: real('actual').default(0),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const monthlyIncome = sqliteTable('monthly_income', {
  id: text('id').primaryKey(),
  entryMonth: text('entry_month').notNull().unique(),
  salary: real('salary').notNull().default(0),
  otherIncome: real('other_income').default(0),
  openingBalance: real('opening_balance'),
  expenseLimit: real('expense_limit'),
  investmentTarget: real('investment_target'),
  savingsTarget: real('savings_target'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const PAYMENT_METHOD_TYPES = ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<PaymentMethodType>(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const cashFlowSpends = sqliteTable('cash_flow_spends', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => cashFlowCategories.id, { onDelete: 'cascade' }),
  paymentMethodId: text('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  description: text('description'),
  spendDate: text('spend_date').notNull(), // ISO date string
  entryMonth: text('entry_month').notNull(), // YYYY-MM for fast lookups
  type: text('type').notNull().$type<CashFlowCategoryType>(), // 'expense' | 'income'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const netWorthTargets = sqliteTable('net_worth_targets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startingValue: real('starting_value').notNull(),
  monthlyInvestment: real('monthly_investment').notNull(),
  yearlyReturnRate: real('yearly_return_rate').notNull(),
  stretchMonthlyInvestment: real('stretch_monthly_investment'),
  startDate: text('start_date').notNull(), // YYYY-MM
  endDate: text('end_date').notNull(), // YYYY-MM
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ── FIRE Simulation ────────────────────────────────────────────────

export const fireSimulations = sqliteTable('fire_simulations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currentAge: integer('current_age').notNull(),
  retirementAge: integer('retirement_age').notNull(),
  lifeExpectancy: integer('life_expectancy').notNull(),
  currentSavings: real('current_savings').notNull(),
  monthlySaving: real('monthly_saving').notNull(),
  annualSavingsIncrease: real('annual_savings_increase').notNull(), // fraction, e.g. 0.22
  returnOnInvestment: real('return_on_investment').notNull(),       // fraction, e.g. 0.125
  capitalGainTax: real('capital_gain_tax').notNull(),               // fraction, e.g. 0.125
  postRetirementMonthlyExpense: real('post_retirement_monthly_expense').notNull(),
  inflationRate: real('inflation_rate').notNull(),                  // fraction, e.g. 0.09
  startYear: integer('start_year').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Type exports for use in services
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type AssetTag = typeof assetTags.$inferSelect;
export type PriceHistoryRecord = typeof priceHistory.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type NewPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;
export type Benchmark = typeof benchmarks.$inferSelect;
export type NewBenchmark = typeof benchmarks.$inferInsert;
export type BenchmarkPrice = typeof benchmarkPrices.$inferSelect;
export type RealizedGain = typeof realizedGains.$inferSelect;
export type CashFlowCategory = typeof cashFlowCategories.$inferSelect;
export type CashFlowEntry = typeof cashFlowEntries.$inferSelect;
export type MonthlyIncome = typeof monthlyIncome.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type CashFlowSpend = typeof cashFlowSpends.$inferSelect;
export type NetWorthTarget = typeof netWorthTargets.$inferSelect;
export type FireSimulation = typeof fireSimulations.$inferSelect;
