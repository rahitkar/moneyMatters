import { pgTable, text, doublePrecision, integer, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';

// ── Users ──────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

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
export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  /** Indian mutual fund ISIN (INF…), when known — used to merge name variants and match broker holdings. */
  isin: text('isin'),
  name: text('name').notNull(),
  assetClass: text('asset_class').notNull().$type<AssetClass>(),
  provider: text('provider').notNull().$type<Provider>(),
  currentPrice: doublePrecision('current_price'),
  previousClose: doublePrecision('previous_close'),
  currency: text('currency').default('USD'),
  lastUpdated: timestamp('last_updated'),
  createdAt: timestamp('created_at').notNull(),
  interestRate: doublePrecision('interest_rate'),
  maturityDate: text('maturity_date'),
  institution: text('institution'),
});

// Holdings table - stores user's positions in assets
export const holdings = pgTable('holdings', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  quantity: doublePrecision('quantity').notNull(),
  purchasePrice: doublePrecision('purchase_price').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

// Tags table - user-defined tags for categorization
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull(),
});

// Asset-Tags junction table
export const assetTags = pgTable('asset_tags', {
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.assetId, t.tagId] }),
}));

// Price history for tracking performance over time
export const priceHistory = pgTable('price_history', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  price: doublePrecision('price').notNull(),
  currency: text('currency').default('USD'),
  recordedAt: timestamp('recorded_at').notNull(),
});

// Transactions table - stores buy/sell transactions
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<TransactionType>(),
  quantity: doublePrecision('quantity').notNull(),
  price: doublePrecision('price').notNull(),
  fees: doublePrecision('fees').default(0),
  fundSourceId: text('fund_source_id').references(() => assets.id, { onDelete: 'set null' }),
  transactionDate: text('transaction_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull(),
});

// Portfolio snapshots for historical performance tracking
export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  snapshotDate: text('snapshot_date').notNull(),
  totalValue: doublePrecision('total_value').notNull(),
  totalCost: doublePrecision('total_cost').notNull(),
  realizedGains: doublePrecision('realized_gains').default(0),
  allocationBreakdown: text('allocation_breakdown'),
  createdAt: timestamp('created_at').notNull(),
});

// Benchmark indices configuration
export const benchmarks = pgTable('benchmarks', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull(),
});

// Benchmark price history
export const benchmarkPrices = pgTable('benchmark_prices', {
  id: text('id').primaryKey(),
  benchmarkId: text('benchmark_id')
    .notNull()
    .references(() => benchmarks.id, { onDelete: 'cascade' }),
  price: doublePrecision('price').notNull(),
  recordedDate: text('recorded_date').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

// Realized gains tracking (from FIFO matching)
export const realizedGains = pgTable('realized_gains', {
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
  quantity: doublePrecision('quantity').notNull(),
  costBasis: doublePrecision('cost_basis').notNull(),
  saleProceeds: doublePrecision('sale_proceeds').notNull(),
  gain: doublePrecision('gain').notNull(),
  gainPercent: doublePrecision('gain_percent').notNull(),
  realizedDate: text('realized_date').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

// ── App Settings ───────────────────────────────────────────────────

export const appSettings = pgTable(
  'app_settings',
  {
    key: text('key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.key, t.userId] }),
  }),
);

export type AppSetting = typeof appSettings.$inferSelect;

// ── Cash Flow ──────────────────────────────────────────────────────

export const CASH_FLOW_CATEGORY_TYPES = ['income', 'expense'] as const;
export type CashFlowCategoryType = (typeof CASH_FLOW_CATEGORY_TYPES)[number];

export const EXPENSE_TAGS = ['need', 'luxury'] as const;
export type ExpenseTag = (typeof EXPENSE_TAGS)[number];

export const cashFlowCategories = pgTable('cash_flow_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().$type<CashFlowCategoryType>(),
  tag: text('tag').$type<ExpenseTag>(),
  defaultBudget: doublePrecision('default_budget').default(0),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull(),
});

export const cashFlowEntries = pgTable('cash_flow_entries', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => cashFlowCategories.id, { onDelete: 'cascade' }),
  entryMonth: text('entry_month').notNull(),
  budget: doublePrecision('budget').default(0),
  actual: doublePrecision('actual').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull(),
});

export const monthlyIncome = pgTable('monthly_income', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryMonth: text('entry_month').notNull(),
  salary: doublePrecision('salary').notNull().default(0),
  otherIncome: doublePrecision('other_income').default(0),
  openingBalance: doublePrecision('opening_balance'),
  expenseLimit: doublePrecision('expense_limit'),
  investmentTarget: doublePrecision('investment_target'),
  savingsTarget: doublePrecision('savings_target'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull(),
});

export const PAYMENT_METHOD_TYPES = ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const paymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().$type<PaymentMethodType>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull(),
});

export const cashFlowSpends = pgTable('cash_flow_spends', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: text('category_id')
    .notNull()
    .references(() => cashFlowCategories.id, { onDelete: 'cascade' }),
  paymentMethodId: text('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id, { onDelete: 'cascade' }),
  amount: doublePrecision('amount').notNull(),
  description: text('description'),
  spendDate: text('spend_date').notNull(),
  entryMonth: text('entry_month').notNull(),
  type: text('type').notNull().$type<CashFlowCategoryType>(),
  createdAt: timestamp('created_at').notNull(),
});

export const netWorthTargets = pgTable('net_worth_targets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startingValue: doublePrecision('starting_value').notNull(),
  monthlyInvestment: doublePrecision('monthly_investment').notNull(),
  yearlyReturnRate: doublePrecision('yearly_return_rate').notNull(),
  stretchMonthlyInvestment: doublePrecision('stretch_monthly_investment'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull(),
});

// ── FIRE Simulation ────────────────────────────────────────────────

export const fireSimulations = pgTable('fire_simulations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  currentAge: integer('current_age').notNull(),
  retirementAge: integer('retirement_age').notNull(),
  lifeExpectancy: integer('life_expectancy').notNull(),
  currentSavings: doublePrecision('current_savings').notNull(),
  monthlySaving: doublePrecision('monthly_saving').notNull(),
  annualSavingsIncrease: doublePrecision('annual_savings_increase').notNull(),
  returnOnInvestment: doublePrecision('return_on_investment').notNull(),
  capitalGainTax: doublePrecision('capital_gain_tax').notNull(),
  postRetirementMonthlyExpense: doublePrecision('post_retirement_monthly_expense').notNull(),
  inflationRate: doublePrecision('inflation_rate').notNull(),
  startYear: integer('start_year').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull(),
});

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
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
