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
  /**
   * Period-scoped breakdown — answers "what's my actual market profit
   * over this window vs. money I added?". The identity holds:
   *   periodEndValue − periodStartValue = periodContributions + periodMarketGain
   */
  periodStartValue: number;
  periodEndValue: number;
  periodContributions: number;
  periodMarketGain: number;
  /** Per-transaction breakdown of `periodContributions`. The sum of
   *  `signedInr` across these rows equals `periodContributions`. */
  periodContributionTxs: PeriodContributionTx[];
}

/**
 * Single transaction kept for the deep-dive view of period contributions.
 * Buys contribute positive `signedInr`; sells contribute negative.
 */
export interface PeriodContributionTx {
  date: string;
  type: 'buy' | 'sell';
  assetId: string;
  assetName: string;
  assetSymbol: string;
  fundSourceName: string | null;
  nativeAmount: number;
  currency: string;
  signedInr: number;
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

// 'transfer' = neither income nor expense — e.g. reimbursement returning,
// wallet top-up, friend returning money. Excluded from income/expense/savings
// totals; tracked separately as `totalTransfers`.
export type CashFlowCategoryType = 'income' | 'expense' | 'transfer';
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
  /** Native-currency amount (USD for foreign assets, INR for Indian). */
  amount: number;
  /** INR-converted amount used by all sums and the cash-flow waterfall. */
  amountInr: number;
  foreignQuantity: number | null;
}

/**
 * Single transaction row contributing to a Bank Account Flow waterfall
 * line (Investment Transfers or Wallet/Broker Transfers). The cash-flow
 * page uses these to expand each total into its underlying purchases.
 */
export interface BankFlowTx {
  date: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
  amountInr: number;
  nativeAmount: number;
  currency: string;
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
    savingsTargetSource: 'manual' | 'fire' | null;
  };
  expenses: ExpenseRow[];
  transfers: IncomeRow[];
  transferSpends: CashFlowSpend[];
  investments: InvestmentRow[];
  spends: CashFlowSpend[];
  paymentMethodBreakdown: PaymentMethodBreakdownRow[];
  waterfall: {
    openingBalance: number | null;
    totalIncome: number;
    cashUpiExpenses: number;
    /** Net CC bill = ccGrossExpenses − ccTransferCredits. What you actually owe. */
    ccBillTotal: number;
    ccGrossExpenses: number;
    ccTransferCredits: number;
    cashUpiTransfersIn: number;
    totalInvested: number;
    bankInvestments: number;
    walletTransfers: number;
    /** Per-transaction breakdown behind the bankInvestments total — buys
     *  of non-cash assets (MFs, stocks) funded directly from the primary
     *  bank. Sorted most-recent first. */
    bankInvestmentTxs: BankFlowTx[];
    /** Per-transaction breakdown behind the walletTransfers total —
     *  bank → broker-wallet movements (Zerodha, INDmoney, etc.). */
    walletTransferTxs: BankFlowTx[];
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
    totalTransfers: number;
    cashUpiTransfersIn: number;
    ccTransferCredits: number;
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
  earliestRetirementAge: number;
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

export interface FireWhatIfScenario {
  id: string;
  name: string;
  original: {
    retirementAge: number;
    corpusAtRetirement: number;
    monthlySaving: number;
    earliestRetirementAge: number;
  };
  adjusted: {
    retirementAge: number;
    corpusAtRetirement: number;
    monthlySaving: number;
    earliestRetirementAge: number;
  };
  /**
   * `retirementAgeShift` is positive when extra saving pulls earliest
   * retirement earlier (good), negative when saving less pushes it later.
   * `savingDelta` is the one-month difference vs the FIRE plan baseline.
   */
  delta: {
    retirementAgeShift: number;
    corpusDelta: number;
    savingDelta: number;
  };
}

export interface FireWhatIfResult {
  scenarios: FireWhatIfScenario[];
}

// ── Savings Goals ──────────────────────────────────────────────────

export interface SavingsGoalBucket {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface GoalLink {
  label: string;
  url: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  bucketId: string | null;
  name: string;
  description: string | null;
  links: string | null; // JSON string of GoalLink[]
  targetAmount: number;
  currency: string;
  deadline: string | null;
  savingsPercent: number;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isCompleted: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  entryMonth: string;
  autoAmount: number;
  manualAmount: number | null;
  notes: string | null;
  createdAt: string;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  bucketId: string | null;
  bucketName: string | null;
  targetAmount: number;
  totalSaved: number;
  percentComplete: number;
  remaining: number;
  deadline: string | null;
  daysRemaining: number | null;
  isOnTrack: boolean;
  savingsPercent: number;
  icon: string | null;
  isCompleted: boolean;
}

export interface GoalAllocation {
  goalId: string;
  goalName: string;
  savingsPercent: number;
  allocatedAmount: number;
}

export interface GoalProgressSummary {
  goals: GoalProgress[];
  summary: {
    totalTarget: number;
    totalSaved: number;
    onTrack: number;
    behind: number;
    completed: number;
    activeCount: number;
  };
}

export interface GoalAllocationsPreview {
  monthlyIncome: number;
  totalAllocatedPercent: number;
  totalEarmarked: number;
  allocations: GoalAllocation[];
}

// API Response types
export interface ApiResponse<T> {
  [key: string]: T;
}
