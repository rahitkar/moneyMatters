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
  usdToInr: number | null;
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
export type TimeInterval = '1D' | '5D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL' | 'CUSTOM';

export interface Transaction {
  id: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number | null;
  fundSourceId: string | null;
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
  fundSource?: {
    id: string;
    name: string;
    symbol: string;
  } | null;
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
  lastActivityDate: string | null;
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
  navHistory: { date: string; nav: number }[];
  currentNAV: number;
  totalUnits: number;
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

// ── Cash Flow ──────────────────────────────────────────────────────

export type CashFlowCategoryType = 'income' | 'expense';
export type ExpenseTag = 'need' | 'luxury';

export interface CashFlowCategory {
  id: string;
  name: string;
  type: CashFlowCategoryType;
  tag: ExpenseTag | null;
  defaultBudget: number | null;
  sortOrder: number | null;
}

export interface CashFlowEntry {
  id: string;
  categoryId: string;
  entryMonth: string;
  budget: number | null;
  actual: number | null;
  notes: string | null;
}

export interface MonthlyIncome {
  id: string;
  entryMonth: string;
  salary: number;
  otherIncome: number | null;
  openingBalance: number | null;
  expenseLimit: number | null;
  investmentTarget: number | null;
  savingsTarget: number | null;
  notes: string | null;
}

export interface ExpenseRow extends CashFlowEntry {
  categoryName: string;
  tag: string | null;
  overspend: number;
}

export interface IncomeRow extends CashFlowEntry {
  categoryName: string;
}

export interface InvestmentRow {
  assetId: string;
  name: string;
  symbol: string;
  currency: string;
  amount: number;
  foreignQuantity: number | null;
}

export type PaymentMethodType = 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'bank_transfer';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  isActive: boolean | null;
}

export interface CashFlowSpend {
  id: string;
  categoryId: string;
  paymentMethodId: string;
  amount: number;
  description: string | null;
  spendDate: string;
  entryMonth: string;
  type: CashFlowCategoryType;
  categoryName: string;
  paymentMethodName: string;
}

export interface PaymentMethodBreakdownRow {
  id: string;
  name: string;
  type: string;
  total: number;
}

export interface CashFlowSettings {
  cycleStartDay: number;
  dob: string | null;
}

export interface CashFlowMonthSummary {
  month: string;
  cycleStartDay: number;
  cycleStart: string;
  cycleEnd: string;
  income: {
    totalIncome: number;
    incomeEntries: IncomeRow[];
    incomeSpends: CashFlowSpend[];
    openingBalance: number | null;
    openingBalanceAutoCarried: boolean;
    expenseLimit: number | null;
    investmentTarget: number | null;
    savingsTarget: number | null;
  };
  expenses: ExpenseRow[];
  investments: InvestmentRow[];
  spends: CashFlowSpend[];
  paymentMethodBreakdown: PaymentMethodBreakdownRow[];
  waterfall: {
    openingBalance: number | null;
    totalIncome: number;
    cashUpiExpenses: number;
    ccBillTotal: number;
    totalInvested: number;
    bankInvestments: number;
    walletTransfers: number;
    closingBalance: number | null;
    savings: number;
  };
  totals: {
    totalIncome: number;
    totalExpenses: number;
    totalBudget: number;
    totalOverspend: number;
    totalNeed: number;
    totalLuxury: number;
    totalInvested: number;
    bankInvestments: number;
    walletTransfers: number;
    netSavings: number;
    remainingForInvestment: number;
    closingBalance: number | null;
    savings: number;
    investmentPct: number;
    needPct: number;
    luxuryPct: number;
  };
}

export interface CashFlowYearlySummary {
  year: string;
  months: CashFlowMonthSummary[];
}

// ── Goals / Net Worth Targets ─────────────────────────────────────

export interface NetWorthTarget {
  id: string;
  name: string;
  startingValue: number;
  monthlyInvestment: number;
  yearlyReturnRate: number;
  stretchMonthlyInvestment: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean | null;
}

export interface ProjectionRow {
  month: string;
  projectedBase: number;
  projectedStretch: number | null;
  actual: number | null;
  deficitBase: number | null;
  deficitStretch: number | null;
}

export interface TargetProjection {
  target: NetWorthTarget;
  params: {
    totalYearlyInvestment: number;
    monthlyRate: number;
    delta: number;
    interestEarned: number;
  };
  rows: ProjectionRow[];
}

// ── FIRE Simulation ───────────────────────────────────────────────

export interface FireSimulation {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlySaving: number;
  annualSavingsIncrease: number;
  returnOnInvestment: number;
  capitalGainTax: number;
  postRetirementMonthlyExpense: number;
  inflationRate: number;
  startYear: number;
  isActive: boolean | null;
}

export interface FireSimulationInput {
  name: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlySaving: number;
  annualSavingsIncrease: number;
  returnOnInvestment: number;
  capitalGainTax: number;
  postRetirementMonthlyExpense: number;
  inflationRate: number;
  startYear: number;
}

export interface FireSimulationRow {
  year: number;
  age: number;
  corpusStart: number;
  savings: number;
  returnOnInvestment: number;
  withdrawals: number;
  monthlySaving: number;
  status: 'accumulating' | 'retired' | 'retired_here' | 'dead' | 'out_of_funds';
}

export interface FireSimulationResult {
  simulation: FireSimulation | FireSimulationInput;
  effectiveReturnRate: number;
  rows: FireSimulationRow[];
  fireAge: number;
  corpusAtRetirement: number;
  fundsLastUntilAge: number;
}

export interface FireLiveProgress {
  id: string;
  name: string;
  projected: number;
  actual: number;
  deficit: number;
}

export interface FireComparisonData {
  simulations: (FireSimulationResult & { id: string; name: string })[];
  actualPortfolio: { year: number; value: number }[];
  liveValue: number;
  liveProgress: FireLiveProgress[];
}

// ── FIRE Monthly Targets ──────────────────────────────────────────

export interface FireMonthlyTargetMonth {
  month: string;
  label: string;
  targets: Record<string, number>;
  investmentTargets: Record<string, number>;
  actual: number | null;
  income: number | null;
  actualInvestment: number;
}

export interface FireMonthlyTargetData {
  fy: number;
  fyLabel: string;
  scenarios: { id: string; name: string; monthlySaving: number }[];
  months: FireMonthlyTargetMonth[];
}

// API Response types
export interface ApiResponse<T> {
  [key: string]: T;
}
