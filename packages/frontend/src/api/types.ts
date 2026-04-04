export type AssetClass =
  | 'stocks'
  | 'etf'
  | 'mutual_fund'
  | 'mutual_fund_equity'
  | 'mutual_fund_debt'
  | 'crypto'
  | 'bonds'
  | 'real_estate'
  | 'vehicle'
  | 'gold'
  | 'gold_physical'
  | 'silver'
  | 'silver_physical'
  | 'metals'
  | 'ppf'
  | 'epf'
  | 'nps'
  | 'fixed_deposit'
  | 'lended'
  | 'cash'
  | 'external_portfolio';

export type Provider = 'yahoo_finance' | 'coingecko' | 'metals_api' | 'manual';

export interface Asset {
  id: string;
  symbol: string;
  /** Mutual fund ISIN when known (INF…) */
  isin?: string | null;
  name: string;
  assetClass: AssetClass;
  provider: Provider;
  currentPrice: number | null;
  currency: string | null;
  lastUpdated: string | null;
  createdAt: string;
  interestRate?: number | null;
  maturityDate?: string | null;
  institution?: string | null;
}

export interface AssetWithTags extends Asset {
  tags: Tag[];
}

export interface Holding {
  id: string;
  assetId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingWithAsset {
  holding: Holding;
  asset: Asset;
}

export interface HoldingWithValue {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  purchasePrice: number;
  currentPrice: number | null;
  currentValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  currency: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
}

export interface TagWithCount extends Tag {
  assetCount: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  currency: string;
  assetCount: number;
  holdingCount: number;
}

export interface AssetAllocation {
  assetClass: AssetClass;
  value: number;
  percentage: number;
  count: number;
}

export interface DimensionSlice {
  label: string;
  value: number;
  percentage: number;
  count: number;
}

export interface MultiDimensionalAllocation {
  byAssetClass: DimensionSlice[];
  byGeography: DimensionSlice[];
  byInstrumentType: DimensionSlice[];
  byRiskProfile: DimensionSlice[];
  byCurrency: DimensionSlice[];
  bySubCategory: DimensionSlice[];
  byLiquidity: DimensionSlice[];
  byOwnership: DimensionSlice[];
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change?: number;
  changePercent?: number;
  provider: Provider;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  assetClass: AssetClass;
  provider: Provider;
}

// Transaction types
export type TransactionType = 'buy' | 'sell';
export type TimeInterval = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';

export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number | null;
  transactionDate: string;
  notes: string | null;
  createdAt: string;
}

export interface TransactionWithAsset extends Transaction {
  asset: {
    symbol: string;
    name: string;
    assetClass: string;
    currency: string;
  };
}

export interface Position {
  assetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  quantity: number;
  averageCost: number;
  totalCost: number;
  currentPrice: number | null;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  realizedGain: number;
}

export interface LotInfo {
  transactionId: string;
  quantity: number;
  remainingQuantity: number;
  price: number;
  date: string;
}

// Performance types
export interface PerformanceMetrics {
  startValue: number;
  endValue: number;
  absoluteReturn: number;
  percentageReturn: number;
  annualizedReturn: number | null;
  totalCost: number;
  realizedGains: number;
  unrealizedGains: number;
}

export interface PortfolioPerformance extends PerformanceMetrics {
  interval: TimeInterval;
  startDate: string;
  endDate: string;
  valueHistory: { date: string; value: number }[];
}

export interface BenchmarkPerformance {
  symbol: string;
  name: string;
  region: string;
  startPrice: number;
  endPrice: number;
  change: number;
  changePercent: number;
  priceHistory: { date: string; price: number }[];
}

export interface PerformanceComparison {
  portfolio: PortfolioPerformance;
  benchmarks: BenchmarkPerformance[];
}

export interface AssetClassPerformance {
  assetClass: AssetClass;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

export interface TagPerformance {
  tagId: string;
  tagName: string;
  tagColor: string;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

// Benchmark types
export interface Benchmark {
  id: string;
  symbol: string;
  name: string;
  region: string;
  isActive: boolean;
  createdAt: string;
}

export interface BenchmarkWithLatestPrice extends Benchmark {
  latestPrice: number | null;
  latestDate: string | null;
}

export interface RealizedGain {
  id: string;
  assetId: string;
  sellTransactionId: string;
  buyTransactionId: string;
  quantity: number;
  costBasis: number;
  saleProceeds: number;
  gain: number;
  gainPercent: number;
  realizedDate: string;
}

// API Response types
export interface ApiResponse<T> {
  [key: string]: T;
}
