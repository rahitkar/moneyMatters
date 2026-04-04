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
  'silver',
  'metals',
  'ppf',
  'epf',
  'nps',
  'fixed_deposit',
  'lended',
  'cash',
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
export const TIME_INTERVALS = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'ALL'] as const;
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
