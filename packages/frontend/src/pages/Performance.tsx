import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Download, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import AssetClassBadge from '../components/AssetClassBadge';
import {
  usePerformanceComparison,
  usePerformanceByAssetClass,
  useBenchmarks,
  useRealizedGainsTotal,
  useExchangeRate,
  useBackfillPrices,
} from '../api/hooks';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../lib/format';
import type { TimeInterval } from '../api/types';

const TIME_INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOM', label: 'Custom' },
];

const PORTFOLIO_SEGMENTS = [
  { key: 'all', label: 'Total Portfolio' },
  { key: 'indian_stocks', label: 'Indian Stocks' },
  { key: 'international_stocks', label: "Int'l Stocks" },
  { key: 'equity_mf', label: 'Equity MF' },
  { key: 'debt_mf', label: 'Debt MF' },
  { key: 'indian_etf', label: 'Indian ETF' },
  { key: 'international_etf', label: "Int'l ETF" },
  { key: 'crypto', label: 'Crypto' },
  { key: 'gold', label: 'Gold' },
  { key: 'all_equity', label: 'All Equity' },
] as const;

const CHART_COLORS = [
  '#22c55e', // Portfolio - green
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#ef4444', // Red
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#f43f5e', // Rose
  '#14b8a6', // Teal
  '#8b5cf6', // Violet
  '#fb923c', // Amber
];

export default function Performance() {
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>('1M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Applied state — drives the API call
  const [appliedInterval, setAppliedInterval] = useState<TimeInterval>('1M');
  const [appliedBenchmarks, setAppliedBenchmarks] = useState<string[]>(['^GSPC', '^NSEI']);
  const [appliedSegments, setAppliedSegments] = useState<string[]>(['all']);
  const [appliedDateRange, setAppliedDateRange] = useState<{ start?: string; end?: string }>({});

  // Draft state — local picks before user hits "Apply"
  const [draftBenchmarks, setDraftBenchmarks] = useState<string[]>(['^GSPC', '^NSEI']);
  const [draftSegments, setDraftSegments] = useState<string[]>(['all']);

  // For non-CUSTOM intervals, apply immediately; for CUSTOM, wait for Apply
  const queryInterval = selectedInterval === 'CUSTOM' ? appliedInterval : selectedInterval;
  const queryStartDate = queryInterval === 'CUSTOM' ? appliedDateRange.start : undefined;
  const queryEndDate = queryInterval === 'CUSTOM' ? appliedDateRange.end : undefined;

  const { data: benchmarks } = useBenchmarks();
  const { data: comparison, isLoading, isFetching } = usePerformanceComparison(
    queryInterval, appliedBenchmarks, appliedSegments,
    queryStartDate, queryEndDate
  );
  const { data: assetClassPerf } = usePerformanceByAssetClass(queryInterval === 'CUSTOM' ? 'ALL' : queryInterval);
  const { data: realizedGains } = useRealizedGainsTotal();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;
  const backfillPrices = useBackfillPrices();

  const hasDraftChanges =
    JSON.stringify(draftBenchmarks.slice().sort()) !== JSON.stringify(appliedBenchmarks.slice().sort()) ||
    JSON.stringify(draftSegments.slice().sort()) !== JSON.stringify(appliedSegments.slice().sort()) ||
    (selectedInterval === 'CUSTOM' && (customStart !== (appliedDateRange.start ?? '') || customEnd !== (appliedDateRange.end ?? '')));

  const handleIntervalChange = (value: TimeInterval) => {
    setSelectedInterval(value);
    if (value !== 'CUSTOM') {
      setAppliedInterval(value);
    }
  };

  const applySelection = () => {
    setAppliedBenchmarks([...draftBenchmarks]);
    setAppliedSegments([...draftSegments]);
    if (selectedInterval === 'CUSTOM' && customStart) {
      setAppliedDateRange({ start: customStart, end: customEnd || undefined });
      setAppliedInterval('CUSTOM');
    }
  };

  const toggleBenchmark = (symbol: string) => {
    setDraftBenchmarks((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const toggleSegment = (key: string) => {
    if (key === 'all') {
      setDraftSegments(['all']);
      return;
    }
    setDraftSegments((prev) => {
      const without = prev.filter((s) => s !== 'all' && s !== key);
      if (prev.includes(key)) {
        return without.length === 0 ? ['all'] : without;
      }
      return [...without, key];
    });
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  // Build chart data
  const chartData = buildChartData(comparison);

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Performance</h1>
        <button
          onClick={() => backfillPrices.mutate()}
          disabled={backfillPrices.isPending}
          className={clsx(
            'btn btn-secondary text-sm',
            backfillPrices.isPending && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Download className={clsx('w-4 h-4', backfillPrices.isPending && 'animate-pulse')} />
          {backfillPrices.isPending ? 'Fetching history...' : 'Backfill Prices'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
      {/* Time Interval Selector */}
      <Card padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_INTERVALS.map((ti) => (
            <button
              key={ti.value}
              onClick={() => handleIntervalChange(ti.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedInterval === ti.value
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
              )}
            >
              {ti.label}
            </button>
          ))}
          {selectedInterval === 'CUSTOM' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              />
              <span className="text-surface-500 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              />
            </>
          )}
        </div>
      </Card>

      {/* Segment & Benchmark Selector */}
      <Card padding="sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-surface-500 font-medium mr-1 shrink-0">Segment:</span>
            {PORTFOLIO_SEGMENTS.map((seg) => (
              <button
                key={seg.key}
                onClick={() => toggleSegment(seg.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  draftSegments.includes(seg.key)
                    ? 'bg-brand-600/30 border-brand-500/50 text-brand-300'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 border-transparent'
                )}
              >
                {seg.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-surface-500 font-medium mr-1 shrink-0">Benchmark:</span>
            {benchmarks?.map((benchmark) => (
              <button
                key={benchmark.id}
                onClick={() => toggleBenchmark(benchmark.symbol)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  draftBenchmarks.includes(benchmark.symbol)
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 border-transparent'
                )}
              >
                {benchmark.name}
              </button>
            ))}
          </div>
          {hasDraftChanges && (
            <div className="flex justify-end pt-1">
              <button
                onClick={applySelection}
                className="btn btn-primary text-xs px-4 py-1.5"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Summary Stats */}
      {usdToInr && (
        <p className="text-xs text-surface-500 text-right tabular-nums -mb-4">
          1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="NAV Return"
            value={`${comparison.portfolio.percentageReturn >= 0 ? '+' : ''}${formatPercent(comparison.portfolio.percentageReturn)}`}
            subValue={`NAV: ${formatNumber(comparison.portfolio.currentNAV)}`}
            isPositive={comparison.portfolio.percentageReturn >= 0}
            icon={comparison.portfolio.percentageReturn >= 0 ? TrendingUp : TrendingDown}
          />
          <StatCard
            label="Total Value"
            value={formatCurrency(comparison.portfolio.endValue, 'INR')}
            usdSubValue={usdToInr ? formatCurrency(comparison.portfolio.endValue / usdToInr, 'USD') : undefined}
            subValue={`Invested: ${formatCurrency(comparison.portfolio.totalCost, 'INR')}`}
            icon={DollarSign}
            variant="brand"
          />
          <StatCard
            label="Total P&L"
            value={`${comparison.portfolio.absoluteReturn >= 0 ? '+' : ''}${formatCurrency(comparison.portfolio.absoluteReturn, 'INR')}`}
            usdSubValue={usdToInr ? `${comparison.portfolio.absoluteReturn >= 0 ? '+' : ''}${formatCurrency(comparison.portfolio.absoluteReturn / usdToInr, 'USD')}` : undefined}
            icon={comparison.portfolio.absoluteReturn >= 0 ? TrendingUp : TrendingDown}
            isPositive={comparison.portfolio.absoluteReturn >= 0}
          />
          <StatCard
            label="Unrealized"
            value={`${comparison.portfolio.unrealizedGains >= 0 ? '+' : ''}${formatCurrency(comparison.portfolio.unrealizedGains, 'INR')}`}
            usdSubValue={usdToInr ? `${comparison.portfolio.unrealizedGains >= 0 ? '+' : ''}${formatCurrency(comparison.portfolio.unrealizedGains / usdToInr, 'USD')}` : undefined}
            icon={comparison.portfolio.unrealizedGains >= 0 ? TrendingUp : TrendingDown}
            isPositive={comparison.portfolio.unrealizedGains >= 0}
          />
          <StatCard
            label="Realized"
            value={`${(realizedGains ?? 0) >= 0 ? '+' : ''}${formatCurrency(realizedGains ?? 0, 'INR')}`}
            usdSubValue={usdToInr ? `${(realizedGains ?? 0) >= 0 ? '+' : ''}${formatCurrency((realizedGains ?? 0) / usdToInr, 'USD')}` : undefined}
            icon={(realizedGains ?? 0) >= 0 ? TrendingUp : TrendingDown}
            isPositive={(realizedGains ?? 0) >= 0}
          />
        </div>
      )}

      {/* Performance Chart */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100">
              Performance Curve (NAV)
              {isFetching && <span className="ml-2 text-xs text-surface-500 animate-pulse">Updating...</span>}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Tracks pure investment returns — deposits &amp; withdrawals are excluded
            </p>
          </div>
          {comparison?.portfolio.annualizedReturn !== null && (
            <span className="text-sm text-surface-400">
              Annualized: {formatPercent(comparison?.portfolio.annualizedReturn ?? 0)}
            </span>
          )}
        </div>

        {chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  fontSize={12}
                  tickFormatter={(d) => formatDate(d)}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                />
                <Tooltip content={<PerfTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
                {comparison?.benchmarks.map((benchmark, idx) => {
                  const dashPatterns = [undefined, '6 3', '2 2', '8 4 2 4'];
                  return (
                  <Line
                    key={benchmark.symbol}
                    type="monotone"
                    dataKey={benchmark.symbol}
                    name={benchmark.name}
                    stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray={dashPatterns[idx % dashPatterns.length]}
                  />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No performance data"
            description="Click 'Backfill Prices' above to fetch historical price data, then the chart will populate."
          />
        )}
      </Card>

      {/* Benchmark Performance Table */}
      {comparison && comparison.benchmarks.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-surface-100 mb-6">
            Benchmark Returns ({selectedInterval === 'CUSTOM' && appliedDateRange.start
              ? `${appliedDateRange.start} to ${appliedDateRange.end || 'now'}`
              : queryInterval})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Index</th>
                  <th className="table-header">Region</th>
                  <th className="table-header text-right">Start</th>
                  <th className="table-header text-right">Current</th>
                  <th className="table-header text-right">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                <tr className="bg-brand-600/10">
                  <td className="table-cell font-medium text-brand-400">
                    Your Portfolio (NAV)
                  </td>
                  <td className="table-cell text-surface-400">—</td>
                  <td className="table-cell text-right tabular-nums">
                    {formatNumber(comparison.portfolio.navHistory?.[0]?.nav ?? 1000)}
                  </td>
                  <td className="table-cell text-right tabular-nums">
                    {formatNumber(comparison.portfolio.currentNAV)}
                  </td>
                  <td
                    className={clsx(
                      'table-cell text-right tabular-nums font-medium',
                      comparison.portfolio.percentageReturn >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    )}
                  >
                    {comparison.portfolio.percentageReturn >= 0 ? '+' : ''}
                    {formatPercent(comparison.portfolio.percentageReturn)}
                  </td>
                </tr>
                {comparison.benchmarks.map((benchmark) => (
                  <tr key={benchmark.symbol} className="hover:bg-surface-800/30">
                    <td className="table-cell font-medium text-surface-100">
                      {benchmark.name}
                    </td>
                    <td className="table-cell text-surface-400">{benchmark.region}</td>
                    <td className="table-cell text-right tabular-nums">
                      {formatNumber(benchmark.startPrice)}
                    </td>
                    <td className="table-cell text-right tabular-nums">
                      {formatNumber(benchmark.endPrice)}
                    </td>
                    <td
                      className={clsx(
                        'table-cell text-right tabular-nums font-medium',
                        benchmark.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {benchmark.changePercent >= 0 ? '+' : ''}
                      {formatPercent(benchmark.changePercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Performance by Asset Class */}
      <Card>
        <h2 className="text-lg font-semibold text-surface-100 mb-6">
          Performance by Asset Class
        </h2>
        {assetClassPerf && assetClassPerf.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Asset Class</th>
                  <th className="table-header text-right">Holdings</th>
                  <th className="table-header text-right">Total Value</th>
                  <th className="table-header text-right">P&L %</th>
                  <th className="table-header text-right">Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {assetClassPerf.map((item) => (
                  <tr key={item.assetClass} className="hover:bg-surface-800/30">
                    <td className="table-cell">
                      <AssetClassBadge assetClass={item.assetClass} />
                    </td>
                    <td className="table-cell text-right tabular-nums">
                      {item.holdings}
                    </td>
                    <td className="table-cell text-right tabular-nums">
                      {formatCurrency(item.currentValue, 'INR')}
                    </td>
                    <td
                      className={clsx(
                        'table-cell text-right tabular-nums font-medium',
                        item.performance.percentageReturn >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      )}
                    >
                      {item.performance.percentageReturn >= 0 ? '+' : ''}
                      {formatPercent(item.performance.percentageReturn)}
                    </td>
                    <td
                      className={clsx(
                        'table-cell text-right tabular-nums',
                        item.performance.realizedGains >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      )}
                    >
                      {formatCurrency(item.performance.realizedGains, 'INR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-surface-500 text-center py-8">No asset class data</p>
        )}
      </Card>
      </div>
    </div>
  );
}

// Custom tooltip showing NAV values + % change
function PerfTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const dataRow = payload[0]?.payload;
  if (!dataRow) return null;

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-surface-400 text-xs mb-2 font-medium">{formatDate(label)}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => {
          const pct = entry.value as number;
          const isPortfolio = entry.dataKey === 'portfolio';
          const rawKey = `_raw_${entry.dataKey}`;
          const rawValue = dataRow[rawKey] as number | undefined;
          const displayName = isPortfolio ? 'Portfolio NAV' : entry.name;

          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-surface-300 font-medium min-w-0">
                {displayName}:
              </span>
              <span className="text-surface-100 tabular-nums font-semibold">
                {rawValue !== undefined ? formatNumber(rawValue) : '—'}
              </span>
              <span
                className={clsx(
                  'tabular-nums text-xs',
                  pct >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Build chart data from comparison — uses NAV history for portfolio.
// Stores both % change (for Y-axis) and raw values (for tooltip).
function buildChartData(comparison: ReturnType<typeof usePerformanceComparison>['data']) {
  if (!comparison) return [];

  const { portfolio, benchmarks } = comparison;
  const navHistory = portfolio.navHistory ?? [];
  const allDates = new Set<string>();

  navHistory.forEach((p) => allDates.add(p.date));
  benchmarks.forEach((b) => b.priceHistory.forEach((p) => allDates.add(p.date)));

  const sortedDates = Array.from(allDates).sort();

  const navStart = navHistory[0]?.nav || 1;
  const benchmarkStarts = benchmarks.map(
    (b) => b.priceHistory[0]?.price || 1
  );

  const navMap = new Map(navHistory.map((p) => [p.date, p.nav]));
  const benchmarkMaps = benchmarks.map(
    (b) => new Map(b.priceHistory.map((p) => [p.date, p.price]))
  );

  const lastKnownNav = { value: navStart };
  const lastKnownBenchmarks = benchmarkStarts.map((s) => ({ value: s }));

  return sortedDates.map((date) => {
    const row: Record<string, string | number> = { date };

    const nav = navMap.get(date) ?? lastKnownNav.value;
    lastKnownNav.value = nav;
    row.portfolio = ((nav - navStart) / navStart) * 100;
    row._raw_portfolio = nav;

    benchmarks.forEach((benchmark, idx) => {
      const price = benchmarkMaps[idx].get(date) ?? lastKnownBenchmarks[idx].value;
      lastKnownBenchmarks[idx].value = price;
      row[benchmark.symbol] = ((price - benchmarkStarts[idx]) / benchmarkStarts[idx]) * 100;
      row[`_raw_${benchmark.symbol}`] = price;
    });

    return row;
  });
}
