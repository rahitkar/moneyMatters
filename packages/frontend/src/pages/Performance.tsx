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
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import AssetClassBadge from '../components/AssetClassBadge';
import {
  usePerformanceComparison,
  usePerformanceByAssetClass,
  useBenchmarks,
  useRealizedGainsTotal,
  useExchangeRate,
} from '../api/hooks';
import { formatCurrency, formatPercent, formatDate } from '../lib/format';
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
];

const CHART_COLORS = [
  '#22c55e', // Portfolio - green
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#ef4444', // Red
];

export default function Performance() {
  const [interval, setInterval] = useState<TimeInterval>('1M');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['^GSPC', '^NSEI']);

  const { data: benchmarks } = useBenchmarks();
  const { data: comparison, isLoading } = usePerformanceComparison(interval, selectedBenchmarks);
  const { data: assetClassPerf } = usePerformanceByAssetClass(interval);
  const { data: realizedGains } = useRealizedGainsTotal();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;

  const toggleBenchmark = (symbol: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
      {/* Time Interval Selector */}
      <Card padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_INTERVALS.map((ti) => (
            <button
              key={ti.value}
              onClick={() => setInterval(ti.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                interval === ti.value
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
              )}
            >
              {ti.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Summary Stats */}
      {usdToInr && (
        <p className="text-xs text-surface-500 text-right tabular-nums -mb-4">
          1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="P&L %"
            value={`${comparison.portfolio.percentageReturn >= 0 ? '+' : ''}${formatPercent(comparison.portfolio.percentageReturn)}`}
            subValue={`${comparison.portfolio.percentageReturn >= 0 ? '+' : ''}${formatCurrency(comparison.portfolio.absoluteReturn, 'INR')}`}
            isPositive={comparison.portfolio.percentageReturn >= 0}
            icon={comparison.portfolio.percentageReturn >= 0 ? TrendingUp : TrendingDown}
          />
          <StatCard
            label="Total Value"
            value={formatCurrency(comparison.portfolio.endValue, 'INR')}
            usdSubValue={usdToInr ? formatCurrency(comparison.portfolio.endValue / usdToInr, 'USD') : undefined}
            subValue={`Invested: ${formatCurrency(comparison.portfolio.totalCost, 'INR')}`}
            isPositive={true}
            neutral
            icon={Activity}
          />
          <StatCard
            label="Total P&L"
            value={formatCurrency(comparison.portfolio.unrealizedGains, 'INR')}
            usdSubValue={usdToInr ? formatCurrency(comparison.portfolio.unrealizedGains / usdToInr, 'USD') : undefined}
            isPositive={comparison.portfolio.unrealizedGains >= 0}
            icon={BarChart3}
          />
          <StatCard
            label="Realized P&L"
            value={formatCurrency(realizedGains ?? 0, 'INR')}
            usdSubValue={usdToInr ? formatCurrency((realizedGains ?? 0) / usdToInr, 'USD') : undefined}
            isPositive={(realizedGains ?? 0) >= 0}
            icon={BarChart3}
          />
        </div>
      )}

      {/* Performance Chart */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-surface-100">
            Portfolio vs Benchmarks
          </h2>
          {comparison?.portfolio.annualizedReturn !== null && (
            <span className="text-sm text-surface-400">
              Annualized: {formatPercent(comparison.portfolio.annualizedReturn)}
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '12px',
                  }}
                  labelFormatter={(d) => formatDate(d)}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`,
                    name,
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
                {comparison?.benchmarks.map((benchmark, idx) => (
                  <Line
                    key={benchmark.symbol}
                    type="monotone"
                    dataKey={benchmark.symbol}
                    name={benchmark.name}
                    stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray={idx % 2 === 0 ? undefined : '5 5'}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No performance data"
            description="Add some transactions to see your portfolio performance."
          />
        )}
      </Card>

      {/* Benchmark Selector */}
      <Card>
        <h2 className="text-lg font-semibold text-surface-100 mb-4">
          Select Benchmarks to Compare
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {benchmarks?.map((benchmark) => (
            <button
              key={benchmark.id}
              onClick={() => toggleBenchmark(benchmark.symbol)}
              className={clsx(
                'p-3 rounded-xl text-left transition-all border',
                selectedBenchmarks.includes(benchmark.symbol)
                  ? 'bg-brand-600/20 border-brand-500/50'
                  : 'bg-surface-800/30 border-surface-700/50 hover:border-surface-600'
              )}
            >
              <p className="font-medium text-surface-100 text-sm">{benchmark.name}</p>
              <p className="text-xs text-surface-500">{benchmark.region}</p>
            </button>
          ))}
        </div>
      </Card>

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

      {/* Benchmark Performance Table */}
      {comparison && comparison.benchmarks.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-surface-100 mb-6">
            Benchmark Returns ({interval})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Index</th>
                  <th className="table-header">Region</th>
                  <th className="table-header text-right">Start Price</th>
                  <th className="table-header text-right">End Price</th>
                  <th className="table-header text-right">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                <tr className="bg-brand-600/10">
                  <td className="table-cell font-medium text-brand-400">
                    Your Portfolio
                  </td>
                  <td className="table-cell text-surface-400">—</td>
                  <td className="table-cell text-right tabular-nums">
                    {formatCurrency(comparison.portfolio.startValue, 'INR')}
                  </td>
                  <td className="table-cell text-right tabular-nums">
                    {formatCurrency(comparison.portfolio.endValue, 'INR')}
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
                      {formatCurrency(benchmark.startPrice)}
                    </td>
                    <td className="table-cell text-right tabular-nums">
                      {formatCurrency(benchmark.endPrice)}
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
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  usdSubValue,
  isPositive,
  icon: Icon,
  neutral,
}: {
  label: string;
  value: string;
  subValue?: string;
  usdSubValue?: string;
  isPositive: boolean;
  icon: React.ElementType;
  neutral?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p
            className={clsx(
              'text-2xl font-bold',
              neutral ? 'text-surface-100' : isPositive ? 'text-green-400' : 'text-red-400'
            )}
          >
            {value}
          </p>
          {usdSubValue && (
            <p className={clsx('text-[10px] mt-0.5', neutral ? 'text-surface-500' : isPositive ? 'text-green-400/60' : 'text-red-400/60')}>
              {usdSubValue}
            </p>
          )}
          {subValue && <p className="text-sm text-surface-500 mt-1">{subValue}</p>}
        </div>
        <div
          className={clsx(
            'p-3 rounded-xl',
            neutral ? 'bg-surface-700/50' : isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          )}
        >
          <Icon
            className={clsx('w-5 h-5', neutral ? 'text-surface-400' : isPositive ? 'text-green-400' : 'text-red-400')}
          />
        </div>
      </div>
    </Card>
  );
}

// Build chart data from comparison
function buildChartData(comparison: ReturnType<typeof usePerformanceComparison>['data']) {
  if (!comparison) return [];

  const { portfolio, benchmarks } = comparison;
  const allDates = new Set<string>();

  // Collect all dates
  portfolio.valueHistory.forEach((p) => allDates.add(p.date));
  benchmarks.forEach((b) => b.priceHistory.forEach((p) => allDates.add(p.date)));

  const sortedDates = Array.from(allDates).sort();

  // Calculate percentage change from start for each series
  const portfolioStart = portfolio.valueHistory[0]?.value || 1;
  const benchmarkStarts = benchmarks.map(
    (b) => b.priceHistory[0]?.price || 1
  );

  // Build portfolio lookup
  const portfolioMap = new Map(portfolio.valueHistory.map((p) => [p.date, p.value]));

  // Build benchmark lookups
  const benchmarkMaps = benchmarks.map(
    (b) => new Map(b.priceHistory.map((p) => [p.date, p.price]))
  );

  return sortedDates.map((date) => {
    const row: Record<string, string | number> = { date };

    // Portfolio percentage change
    const portfolioValue = portfolioMap.get(date);
    if (portfolioValue !== undefined) {
      row.portfolio = ((portfolioValue - portfolioStart) / portfolioStart) * 100;
    }

    // Benchmark percentage changes
    benchmarks.forEach((benchmark, idx) => {
      const price = benchmarkMaps[idx].get(date);
      if (price !== undefined) {
        row[benchmark.symbol] = ((price - benchmarkStarts[idx]) / benchmarkStarts[idx]) * 100;
      }
    });

    return row;
  });
}
