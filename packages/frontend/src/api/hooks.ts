import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Asset,
  AssetWithTags,
  Holding,
  HoldingWithAsset,
  HoldingWithValue,
  Tag,
  TagWithCount,
  PortfolioSummary,
  AssetAllocation,
  MultiDimensionalAllocation,
  SearchResult,
  AssetClass,
  Provider,
  Transaction,
  TransactionWithAsset,
  TransactionType,
  Position,
  TimeInterval,
  PortfolioPerformance,
  PerformanceComparison,
  AssetClassPerformance,
  TagPerformance,
  BenchmarkWithLatestPrice,
  BenchmarkPerformance,
  RealizedGain,
} from './types';

// Query keys
export const queryKeys = {
  assets: ['assets'] as const,
  asset: (id: string) => ['assets', id] as const,
  holdings: ['holdings'] as const,
  holdingsWithAssets: ['holdings', 'with-assets'] as const,
  tags: ['tags'] as const,
  tagsWithCounts: ['tags', 'with-counts'] as const,
  portfolioSummary: ['portfolio', 'summary'] as const,
  portfolioAllocation: ['portfolio', 'allocation'] as const,
  portfolioAllocationMulti: ['portfolio', 'allocation', 'multi'] as const,
  portfolioHoldings: ['portfolio', 'holdings'] as const,
  topPerformers: ['portfolio', 'top-performers'] as const,
  worstPerformers: ['portfolio', 'worst-performers'] as const,
  search: (query: string) => ['search', query] as const,
  // Transactions
  transactions: ['transactions'] as const,
  transactionsWithAssets: ['transactions', 'with-assets'] as const,
  positions: ['positions'] as const,
  position: (assetId: string) => ['positions', assetId] as const,
  realizedGains: ['realized-gains'] as const,
  // Performance
  performance: (interval: TimeInterval) => ['performance', interval] as const,
  performanceComparison: (interval: TimeInterval, benchmarks: string[], segments: string[], startDate?: string, endDate?: string) =>
    ['performance', 'compare', interval, benchmarks, segments, startDate, endDate] as const,
  performanceByAssetClass: (interval: TimeInterval) =>
    ['performance', 'by-asset-class', interval] as const,
  performanceByTag: (tagId: string, interval: TimeInterval) =>
    ['performance', 'tag', tagId, interval] as const,
  // Benchmarks
  benchmarks: ['benchmarks'] as const,
  benchmarkPerformance: (symbol: string, interval: TimeInterval) =>
    ['benchmarks', symbol, 'performance', interval] as const,
  exchangeRate: (from: string, to: string) => ['exchange-rate', from, to] as const,
};

// Assets
export function useAssets() {
  return useQuery({
    queryKey: queryKeys.assets,
    queryFn: () => api.get<{ assets: AssetWithTags[] }>('/assets').then((r) => r.assets),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: queryKeys.asset(id),
    queryFn: () => api.get<{ asset: AssetWithTags }>(`/assets/${id}`).then((r) => r.asset),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      symbol: string;
      name: string;
      assetClass: AssetClass;
      provider: Provider;
      currentPrice?: number;
      currency?: string;
      interestRate?: number | null;
      maturityDate?: string | null;
      institution?: string | null;
    }) => api.post<{ asset: Asset }>('/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; assetClass?: AssetClass; currentPrice?: number }) =>
      api.put<{ asset: Asset }>(`/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/assets/${id}`),
    onSuccess: () => {
      console.log('Asset deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.realizedGains });
      queryClient.invalidateQueries({ queryKey: queryKeys.topPerformers });
      queryClient.invalidateQueries({ queryKey: queryKeys.worstPerformers });
    },
    onError: (error) => {
      console.error('Failed to delete asset:', error);
      alert(`Failed to delete asset: ${error.message}`);
    },
  });
}

export function useUpdateBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, balance }: { assetId: string; balance: number }) =>
      api.put<{ asset: Asset; position: { quantity: number; balance: number; pricePerUnit: number } }>(
        `/assets/${assetId}/balance`,
        { balance }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

export function useSetAssetTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, tagIds }: { assetId: string; tagIds: string[] }) =>
      api.put<{ asset: AssetWithTags }>(`/assets/${assetId}/tags`, { tagIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
    },
  });
}

export function useBulkTagAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetIds, tagIds, action }: { assetIds: string[]; tagIds: string[]; action: 'add' | 'remove' }) =>
      api.post<{ success: boolean; action: string; count: number }>('/assets/bulk-tags', { assetIds, tagIds, action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

// Holdings
export function useHoldings() {
  return useQuery({
    queryKey: queryKeys.holdings,
    queryFn: () => api.get<{ holdings: Holding[] }>('/holdings').then((r) => r.holdings),
  });
}

export function useHoldingsWithAssets() {
  return useQuery({
    queryKey: queryKeys.holdingsWithAssets,
    queryFn: () => api.get<{ holdings: HoldingWithAsset[] }>('/holdings/with-assets').then((r) => r.holdings),
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      assetId: string;
      quantity: number;
      purchasePrice: number;
      purchaseDate: string;
      notes?: string;
    }) => api.post<{ holding: Holding }>('/holdings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; quantity?: number; purchasePrice?: number; purchaseDate?: string; notes?: string }) =>
      api.put<{ holding: Holding }>(`/holdings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/holdings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
    onError: (error) => {
      console.error('Failed to delete holding:', error);
      alert(`Failed to delete holding: ${error.message}`);
    },
  });
}

// Tags
export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.get<{ tags: Tag[] }>('/tags').then((r) => r.tags),
  });
}

export function useTagsWithCounts() {
  return useQuery({
    queryKey: queryKeys.tagsWithCounts,
    queryFn: () => api.get<{ tags: TagWithCount[] }>('/tags/with-counts').then((r) => r.tags),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string; description?: string }) =>
      api.post<{ tag: Tag }>('/tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string; description?: string }) =>
      api.put<{ tag: Tag }>(`/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
    },
    onError: (error) => {
      console.error('Failed to delete tag:', error);
      alert(`Failed to delete tag: ${error.message}`);
    },
  });
}

// Portfolio
export function usePortfolioSummary() {
  return useQuery({
    queryKey: queryKeys.portfolioSummary,
    queryFn: () => api.get<{ summary: PortfolioSummary }>('/portfolio/summary').then((r) => r.summary),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function usePortfolioAllocation() {
  return useQuery({
    queryKey: queryKeys.portfolioAllocation,
    queryFn: () => api.get<{ allocation: AssetAllocation[] }>('/portfolio/allocation').then((r) => r.allocation),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useMultiDimensionalAllocation() {
  return useQuery({
    queryKey: queryKeys.portfolioAllocationMulti,
    queryFn: () => api.get<{ allocation: MultiDimensionalAllocation }>('/portfolio/allocation/multi').then((r) => r.allocation),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function usePortfolioHoldings() {
  return useQuery({
    queryKey: queryKeys.portfolioHoldings,
    queryFn: () => api.get<{ holdings: HoldingWithValue[] }>('/portfolio/holdings').then((r) => r.holdings),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useTopPerformers(limit = 5) {
  return useQuery({
    queryKey: queryKeys.topPerformers,
    queryFn: () => api.get<{ holdings: HoldingWithValue[] }>(`/portfolio/top-performers?limit=${limit}`).then((r) => r.holdings),
  });
}

export function useWorstPerformers(limit = 5) {
  return useQuery({
    queryKey: queryKeys.worstPerformers,
    queryFn: () => api.get<{ holdings: HoldingWithValue[] }>(`/portfolio/worst-performers?limit=${limit}`).then((r) => r.holdings),
  });
}

// Exchange Rates
export function useExchangeRate(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.exchangeRate(from, to),
    queryFn: () =>
      api.get<{ rate: { from: string; to: string; rate: number; date: string; fetchedAt: string } }>(
        `/market-data/rate/${from}/${to}`
      ).then((r) => r.rate),
    enabled: from !== to,
    staleTime: Infinity,
    retry: 1,
  });
}

// Market Data
export function useSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => api.get<{ results: SearchResult[] }>(`/market-data/search?query=${encodeURIComponent(query)}`).then((r) => r.results),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useRefreshPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; updated: number; failed: number }>('/market-data/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
      queryClient.invalidateQueries({ queryKey: queryKeys.exchangeRate('USD', 'INR') });
      queryClient.invalidateQueries({ queryKey: ['day-changes'] });
    },
  });
}

// Import
export function useImportHoldings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      rows: Array<{
        symbol: string;
        name?: string;
        assetClass?: AssetClass;
        quantity: number;
        purchasePrice: number;
        purchaseDate: string;
        notes?: string;
      }>;
      skipExisting?: boolean;
      fundSourceId?: string;
    }) => api.post<{ success: boolean; results: { imported: number; skipped: number; errors: Array<{ row: number; error: string }> } }>('/import/holdings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

// Zerodha Tradebook Import
export interface TradebookImportResult {
  success: boolean;
  results: {
    imported: number;
    skipped: number;
    errors: Array<{ row: number; symbol: string; error: string }>;
    parseErrors: Array<{ row: number; error: string }>;
    filteredOut?: Array<{ row: number; symbol: string; reason: string }>;
    summary: {
      totalBuys: number;
      totalSells: number;
      uniqueSymbols: number;
    };
  };
}

export function useImportTradebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { data: Record<string, string>[]; kind: 'stocks' | 'mutual_funds' }) =>
      api.post<TradebookImportResult>('/import/tradebook', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.realizedGains });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

// ============ TRANSACTIONS ============

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: () => api.get<{ transactions: Transaction[] }>('/transactions').then((r) => r.transactions),
  });
}

export function useTransactionsWithAssets() {
  return useQuery({
    queryKey: queryKeys.transactionsWithAssets,
    queryFn: () =>
      api.get<{ transactions: TransactionWithAsset[] }>('/transactions/with-assets').then((r) => r.transactions),
  });
}

export function usePositions() {
  return useQuery({
    queryKey: queryKeys.positions,
    queryFn: () => api.get<{ positions: Position[] }>('/transactions/positions').then((r) => r.positions),
    refetchInterval: 1000 * 60 * 5,
  });
}

export type DayChangeMap = Record<string, { previousPrice: number; dayChange: number; dayChangePercent: number; dayChangeValue: number; previousValueInr: number }>;
export interface DayChangesResponse { dayChanges: DayChangeMap; totalDayChange: number; totalDayChangePercent: number }

export function useDayChanges() {
  return useQuery({
    queryKey: ['day-changes'],
    queryFn: () => api.get<DayChangesResponse>('/transactions/positions/day-changes'),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function usePosition(assetId: string) {
  return useQuery({
    queryKey: queryKeys.position(assetId),
    queryFn: () => api.get<{ position: Position }>(`/transactions/positions/${assetId}`).then((r) => r.position),
    enabled: !!assetId,
  });
}

export function useRealizedGainsTotal() {
  return useQuery({
    queryKey: queryKeys.realizedGains,
    queryFn: () =>
      api.get<{ totalRealizedGains: number }>('/transactions/realized-gains').then((r) => r.totalRealizedGains),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      assetId: string;
      type: TransactionType;
      quantity: number;
      price: number;
      fees?: number;
      fundSourceId?: string;
      transactionDate: string;
      notes?: string;
    }) => api.post<{ transaction: Transaction }>('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.realizedGains });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
    },
  });
}

export function useApplyStockSplit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, ratio }: { assetId: string; ratio: number }) =>
      api.post<{ success: boolean; adjustedCount: number }>(`/assets/${assetId}/split`, { ratio }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactionsWithAssets });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.realizedGains });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioAllocation });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.realizedGains });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
    onError: (error) => {
      console.error('Failed to delete transaction:', error);
      alert(`Failed to delete transaction: ${error.message}`);
    },
  });
}

// ============ PERFORMANCE ============

export function usePortfolioPerformance(interval: TimeInterval = '1M') {
  return useQuery({
    queryKey: queryKeys.performance(interval),
    queryFn: () =>
      api.get<{ performance: PortfolioPerformance }>(`/performance/portfolio?interval=${interval}`).then((r) => r.performance),
  });
}

export type AllocDimension = 'bySubCategory' | 'byAssetClass' | 'byGeography' | 'byInstrumentType' | 'byRiskProfile' | 'byCurrency' | 'byLiquidity' | 'byOwnership';

export function usePortfolioBreakdown(interval: TimeInterval = '1M', dimension: AllocDimension = 'byRiskProfile') {
  return useQuery({
    queryKey: ['portfolio-breakdown', interval, dimension],
    queryFn: () =>
      api.get<{ series: Record<string, number | string>[] }>(
        `/performance/portfolio/breakdown?interval=${interval}&dimension=${dimension}`
      ).then((r) => r.series),
  });
}

export function usePerformanceComparison(
  interval: TimeInterval = '1M',
  benchmarks: string[] = ['^GSPC', '^NSEI'],
  segments: string[] = ['all'],
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: queryKeys.performanceComparison(interval, benchmarks, segments, startDate, endDate),
    queryFn: () => {
      const params = new URLSearchParams({ interval, benchmarks: benchmarks.join(',') });
      if (segments.length > 0 && !segments.includes('all')) {
        params.set('segment', segments.join(','));
      }
      if (interval === 'CUSTOM' && startDate) params.set('startDate', startDate);
      if (interval === 'CUSTOM' && endDate) params.set('endDate', endDate);
      return api
        .get<{ comparison: PerformanceComparison }>(
          `/performance/compare?${params.toString()}`
        )
        .then((r) => r.comparison);
    },
    enabled: interval !== 'CUSTOM' || !!startDate,
  });
}

export function usePerformanceByAssetClass(interval: TimeInterval = '1M') {
  return useQuery({
    queryKey: queryKeys.performanceByAssetClass(interval),
    queryFn: () =>
      api
        .get<{ performance: AssetClassPerformance[] }>(`/performance/by-asset-class?interval=${interval}`)
        .then((r) => r.performance),
  });
}

export function usePerformanceByTag(tagId: string, interval: TimeInterval = '1M') {
  return useQuery({
    queryKey: queryKeys.performanceByTag(tagId, interval),
    queryFn: () =>
      api.get<{ performance: TagPerformance }>(`/performance/tag/${tagId}?interval=${interval}`).then((r) => r.performance),
    enabled: !!tagId,
  });
}

export function useTakeSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/performance/snapshot'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

// ============ BENCHMARKS ============

export function useBenchmarks() {
  return useQuery({
    queryKey: queryKeys.benchmarks,
    queryFn: () =>
      api.get<{ benchmarks: BenchmarkWithLatestPrice[] }>('/benchmarks').then((r) => r.benchmarks),
  });
}

export function useBenchmarkPerformance(symbol: string, interval: TimeInterval = '1M') {
  return useQuery({
    queryKey: queryKeys.benchmarkPerformance(symbol, interval),
    queryFn: () =>
      api
        .get<{ performance: BenchmarkPerformance }>(`/benchmarks/${encodeURIComponent(symbol)}/performance?interval=${interval}`)
        .then((r) => r.performance),
    enabled: !!symbol,
  });
}

export function useRefreshBenchmarks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/benchmarks/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.benchmarks });
      queryClient.invalidateQueries({ queryKey: ['performance'] });
    },
  });
}

export function useBackfillPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; updated: number; skipped: number; failed: number }>('/market-data/backfill'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioHoldings });
    },
  });
}

// ── Cash Flow Settings ──────────────────────────────────────────

export function useCashFlowSettings() {
  return useQuery({
    queryKey: ['cashflow', 'settings'] as const,
    queryFn: () => api.get<import('./types').CashFlowSettings>('/cash-flow/settings'),
  });
}

export function useUpdateCashFlowSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { cycleStartDay?: number; dob?: string }) =>
      api.put<import('./types').CashFlowSettings>('/cash-flow/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

// ── Cash Flow hooks ─────────────────────────────────────────────

export function useCashFlowCategories() {
  return useQuery({
    queryKey: ['cashflow', 'categories'] as const,
    queryFn: () => api.get<{ categories: import('./types').CashFlowCategory[] }>('/cash-flow/categories').then((r) => r.categories),
  });
}

export function useCashFlowSummary(month: string) {
  return useQuery({
    queryKey: ['cashflow', 'summary', month] as const,
    queryFn: () => api.get<{ summary: import('./types').CashFlowMonthSummary }>(`/cash-flow/summary?month=${month}`).then((r) => r.summary),
    enabled: !!month,
  });
}

export function useCashFlowYearly(year: string) {
  return useQuery({
    queryKey: ['cashflow', 'yearly', year] as const,
    queryFn: () => api.get<{ summary: import('./types').CashFlowYearlySummary }>(`/cash-flow/yearly?year=${year}`).then((r) => r.summary),
    enabled: !!year,
  });
}

export function useCashFlowIncome(month: string) {
  return useQuery({
    queryKey: ['cashflow', 'income', month] as const,
    queryFn: () => api.get<{ income: import('./types').MonthlyIncome | null }>(`/cash-flow/income?month=${month}`).then((r) => r.income),
    enabled: !!month,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: 'income' | 'expense'; tag?: 'need' | 'luxury'; defaultBudget?: number; sortOrder?: number }) =>
      api.post<{ category: import('./types').CashFlowCategory }>('/cash-flow/categories', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; tag?: 'need' | 'luxury'; defaultBudget?: number; sortOrder?: number }) =>
      api.put<{ category: import('./types').CashFlowCategory }>(`/cash-flow/categories/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cash-flow/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useUpsertEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoryId: string; entryMonth: string; budget?: number; actual?: number; notes?: string }) =>
      api.post<{ entry: import('./types').CashFlowEntry }>('/cash-flow/entries', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; budget?: number; actual?: number; notes?: string }) =>
      api.put<{ entry: import('./types').CashFlowEntry }>(`/cash-flow/entries/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cash-flow/entries/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useUpsertMonthConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, ...data }: {
      month: string;
      openingBalance?: number;
      expenseLimit?: number;
      investmentTarget?: number;
      savingsTarget?: number;
      notes?: string;
    }) =>
      api.put<{ income: import('./types').MonthlyIncome }>(`/cash-flow/income?month=${month}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useInitMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => api.post<{ created: number }>('/cash-flow/init-month', { month }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

// ── Payment Method hooks ────────────────────────────────────────

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['cashflow', 'payment-methods'] as const,
    queryFn: () => api.get<{ methods: import('./types').PaymentMethod[] }>('/cash-flow/payment-methods').then((r) => r.methods),
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: import('./types').PaymentMethodType }) =>
      api.post<{ method: import('./types').PaymentMethod }>('/cash-flow/payment-methods', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cash-flow/payment-methods/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

// ── Spend hooks ─────────────────────────────────────────────────

export function useAddSpend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoryId: string; paymentMethodId: string; amount: number; description?: string; spendDate: string; type: 'expense' | 'income' }) =>
      api.post<{ spend: import('./types').CashFlowSpend }>('/cash-flow/spends', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useUpdateSpend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; categoryId?: string; paymentMethodId?: string; amount?: number; description?: string; spendDate?: string }) =>
      api.put<{ spend: import('./types').CashFlowSpend }>(`/cash-flow/spends/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

export function useDeleteSpend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cash-flow/spends/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
}

// ── Goal hooks ──────────────────────────────────────────────────

export function useGoalTargets() {
  return useQuery({
    queryKey: ['goals', 'targets'] as const,
    queryFn: () => api.get<{ targets: import('./types').NetWorthTarget[] }>('/goals/targets').then((r) => r.targets),
  });
}

export function useGoalProjection(id: string | null) {
  return useQuery({
    queryKey: ['goals', 'projection', id] as const,
    queryFn: () => api.get<{ projection: import('./types').TargetProjection }>(`/goals/targets/${id}/projection`).then((r) => r.projection),
    enabled: !!id,
  });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; startingValue: number; monthlyInvestment: number; yearlyReturnRate: number; stretchMonthlyInvestment?: number; startDate: string; endDate: string }) =>
      api.post<{ target: import('./types').NetWorthTarget }>('/goals/targets', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      api.put<{ target: import('./types').NetWorthTarget }>(`/goals/targets/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

export function useDeleteTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/targets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

// ── FIRE Simulation hooks ───────────────────────────────────────

export function useFireSimulations() {
  return useQuery({
    queryKey: ['fire', 'simulations'] as const,
    queryFn: () => api.get<{ simulations: import('./types').FireSimulation[] }>('/fire/simulations').then((r) => r.simulations),
  });
}

export function useFireAutoSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ result: { created: number; updated: number } }>('/fire/auto-seed'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire'] }); },
  });
}

export function useFireSyncPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ result: { synced: number; liveValue: number } }>('/fire/sync-portfolio'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire'] }); },
  });
}

export function useFireCompare() {
  return useQuery({
    queryKey: ['fire', 'compare'] as const,
    queryFn: () => api.get<{ data: import('./types').FireComparisonData }>('/fire/compare').then((r) => r.data),
  });
}

export function useFireMonthlyTargets(fy?: number) {
  return useQuery({
    queryKey: ['fire', 'monthly-targets', fy] as const,
    queryFn: () =>
      api.get<{ data: import('./types').FireMonthlyTargetData }>(
        fy ? `/fire/monthly-targets?fy=${fy}` : '/fire/monthly-targets',
      ).then((r) => r.data),
  });
}

export function useFireSimulationResult(id: string | null) {
  return useQuery({
    queryKey: ['fire', 'result', id] as const,
    queryFn: () => api.get<{ result: import('./types').FireSimulationResult }>(`/fire/simulations/${id}/run`).then((r) => r.result),
    enabled: !!id,
  });
}

export function useFirePreview() {
  return useMutation({
    mutationFn: (data: import('./types').FireSimulationInput) =>
      api.post<{ result: import('./types').FireSimulationResult }>('/fire/preview', data).then((r) => r.result),
  });
}

export function useCreateFireSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: import('./types').FireSimulationInput) =>
      api.post<{ simulation: import('./types').FireSimulation }>('/fire/simulations', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire'] }); },
  });
}

export function useUpdateFireSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      api.put<{ simulation: import('./types').FireSimulation }>(`/fire/simulations/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire'] }); },
  });
}

export function useDeleteFireSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/fire/simulations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fire'] }); },
  });
}

// ============ REPORTS ============

export function useReport(period: 'monthly' | 'quarterly' | 'yearly', start: string) {
  return useQuery({
    queryKey: ['reports', period, start],
    queryFn: () => api.get<Record<string, unknown>>(`/reports?period=${period}&start=${start}`),
    enabled: !!start,
  });
}
