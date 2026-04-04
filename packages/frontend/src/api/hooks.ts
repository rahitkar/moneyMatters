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
  performanceComparison: (interval: TimeInterval, benchmarks: string[]) =>
    ['performance', 'compare', interval, benchmarks] as const,
  performanceByAssetClass: (interval: TimeInterval) =>
    ['performance', 'by-asset-class', interval] as const,
  performanceByTag: (tagId: string, interval: TimeInterval) =>
    ['performance', 'tag', tagId, interval] as const,
  // Benchmarks
  benchmarks: ['benchmarks'] as const,
  benchmarkPerformance: (symbol: string, interval: TimeInterval) =>
    ['benchmarks', symbol, 'performance', interval] as const,
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
    queryKey: ['exchange-rate', from, to] as const,
    queryFn: () =>
      api.get<{ rate: { from: string; to: string; rate: number; date: string } }>(
        `/market-data/rate/${from}/${to}`
      ).then((r) => r.rate),
    enabled: from !== to,
    staleTime: 1000 * 60 * 30, // 30 minutes
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

export function usePerformanceComparison(interval: TimeInterval = '1M', benchmarks: string[] = ['^GSPC', '^NSEI']) {
  return useQuery({
    queryKey: queryKeys.performanceComparison(interval, benchmarks),
    queryFn: () =>
      api
        .get<{ comparison: PerformanceComparison }>(
          `/performance/compare?interval=${interval}&benchmarks=${benchmarks.join(',')}`
        )
        .then((r) => r.comparison),
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
