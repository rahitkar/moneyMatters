import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  PieChart,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { clsx } from 'clsx';
import Card from '../components/Card';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
// AssetClassBadge not needed — multi-dim allocation uses label strings
import {
  usePortfolioSummary,
  useMultiDimensionalAllocation,
  usePortfolioHoldings,
  useTopPerformers,
  useWorstPerformers,
  usePortfolioPerformance,
  useRealizedGainsTotal,
  useExchangeRate,
} from '../api/hooks';
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../lib/format';
import CurrencyValue from '../components/CurrencyValue';
import type { TimeInterval, DimensionSlice } from '../api/types';

type AllocDimension = 'bySubCategory' | 'byAssetClass' | 'byGeography' | 'byInstrumentType' | 'byRiskProfile' | 'byCurrency';

const DIMENSION_TABS: { value: AllocDimension; label: string }[] = [
  { value: 'bySubCategory', label: 'Sub-Category' },
  { value: 'byAssetClass', label: 'Asset Class' },
  { value: 'byGeography', label: 'Geography' },
  { value: 'byInstrumentType', label: 'Instrument' },
  { value: 'byRiskProfile', label: 'Risk Profile' },
  { value: 'byCurrency', label: 'Currency' },
];

const SLICE_COLORS = [
  '#3b82f6', '#a855f7', '#22c55e', '#eab308', '#ef4444',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#ec4899',
  '#84cc16', '#f59e0b', '#8b5cf6', '#10b981', '#e11d48',
  '#0ea5e9', '#d946ef', '#64748b',
];

function getSliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

const TIME_INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'YTD', label: 'YTD' },
];

export default function Dashboard() {
  const [perfInterval, setPerfInterval] = useState<TimeInterval>('1M');
  const [allocDimension, setAllocDimension] = useState<AllocDimension>('bySubCategory');
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: multiAlloc, isLoading: allocationLoading } = useMultiDimensionalAllocation();
  const { data: holdings } = usePortfolioHoldings();
  const { data: topPerformers } = useTopPerformers(5);
  const { data: worstPerformers } = useWorstPerformers(5);
  const { data: performance } = usePortfolioPerformance(perfInterval);
  const { data: realizedGains } = useRealizedGainsTotal();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;

  if (summaryLoading || allocationLoading) {
    return <LoadingPage />;
  }

  if (!summary || summary.holdingCount === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-surface-100 mb-8">Dashboard</h1>
        <Card>
          <EmptyState
            icon={Wallet}
            title="No holdings yet"
            description="Start by adding some assets and holdings to track your portfolio."
            action={
              <a href="/assets" className="btn btn-primary">
                Add Your First Asset
              </a>
            }
          />
        </Card>
      </div>
    );
  }

  const isPositive = summary.totalGain >= 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
        <p className="text-sm text-surface-500">
          {summary.holdingCount} holdings across {summary.assetCount} assets
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Total Value</p>
              <p className="stat-value text-surface-100">
                {formatCurrency(summary.totalValue, summary.currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-brand-500/20">
              <DollarSign className="w-6 h-6 text-brand-400" />
            </div>
          </div>
        </Card>

        <Card className="animate-slide-up animate-delay-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Total Cost</p>
              <p className="stat-value text-surface-100">
                {formatCurrency(summary.totalCost, summary.currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-700/50">
              <Wallet className="w-6 h-6 text-surface-400" />
            </div>
          </div>
        </Card>

        <Card className="animate-slide-up animate-delay-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Total Gain/Loss</p>
              <p
                className={clsx(
                  'stat-value',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {isPositive ? '+' : ''}
                {formatCurrency(summary.totalGain, summary.currency)}
              </p>
            </div>
            <div
              className={clsx(
                'p-3 rounded-xl',
                isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-6 h-6 text-green-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-400" />
              )}
            </div>
          </div>
        </Card>

        <Card className="animate-slide-up animate-delay-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Return %</p>
              <p
                className={clsx(
                  'stat-value',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {isPositive ? '+' : ''}
                {formatPercent(summary.totalGainPercent)}
              </p>
            </div>
            <div
              className={clsx(
                'p-3 rounded-xl',
                isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
              )}
            >
              <PieChart className="w-6 h-6 text-surface-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Allocation Chart & Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Dimensional Allocation Chart */}
        <Card className="lg:col-span-1 animate-slide-up animate-delay-400">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">
            Portfolio Allocation
          </h2>

          {/* Dimension tabs */}
          <div className="flex flex-wrap gap-1 mb-4">
            {DIMENSION_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setAllocDimension(tab.value)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                  allocDimension === tab.value
                    ? 'bg-brand-600/30 text-brand-300'
                    : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800/50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(() => {
            const slices: DimensionSlice[] = multiAlloc?.[allocDimension] ?? [];
            if (slices.length === 0) {
              return <p className="text-surface-500 text-center py-8">No allocation data</p>;
            }
            return (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={slices}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {slices.map((_, idx) => (
                          <Cell key={idx} fill={getSliceColor(idx)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#27272a',
                          border: '1px solid #3f3f46',
                          borderRadius: '12px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
                  {slices.map((item, idx) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getSliceColor(idx) }}
                        />
                        <span className="text-xs text-surface-300 truncate">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-xs text-surface-400 tabular-nums flex-shrink-0 ml-2">
                        {formatPercent(item.percentage)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>

        {/* Holdings Table */}
        <Card className="lg:col-span-2 animate-slide-up animate-delay-500">
          <h2 className="text-lg font-semibold text-surface-100 mb-6">
            Holdings Overview
          </h2>
          {holdings && holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="table-header">Asset</th>
                    <th className="table-header text-right">Quantity</th>
                    <th className="table-header text-right">Value</th>
                    <th className="table-header text-right">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {holdings.slice(0, 10).map((holding) => (
                    <tr
                      key={holding.id}
                      className="hover:bg-surface-800/30 transition-colors"
                    >
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-surface-100">
                            {holding.symbol}
                          </p>
                          <p className="text-xs text-surface-500 truncate max-w-[200px]">
                            {holding.name}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        {formatNumber(holding.quantity)}
                      </td>
                      <td className="table-cell text-right tabular-nums">
                        <CurrencyValue value={holding.currentValue} currency={holding.currency || 'INR'} usdToInr={usdToInr} />
                      </td>
                      <td className="table-cell text-right">
                        <div
                          className={clsx(
                            'tabular-nums',
                            holding.gain >= 0 ? 'text-green-400' : 'text-red-400'
                          )}
                        >
                          <CurrencyValue value={holding.gain} currency={holding.currency || 'INR'} usdToInr={usdToInr} sign />
                          <span className="text-xs ml-1">
                            ({formatPercent(holding.gainPercent)})
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {holdings.length > 10 && (
                <div className="text-center pt-4">
                  <a
                    href="/holdings"
                    className="text-sm text-brand-400 hover:text-brand-300"
                  >
                    View all {holdings.length} holdings →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-surface-500 text-center py-8">No holdings yet</p>
          )}
        </Card>
      </div>

      {/* Performance Chart */}
      <Card className="animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-400" />
            Portfolio Performance
          </h2>
          <div className="flex items-center gap-2">
            {TIME_INTERVALS.map((ti) => (
              <button
                key={ti.value}
                onClick={() => setPerfInterval(ti.value)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  perfInterval === ti.value
                    ? 'bg-brand-600 text-white'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
                )}
              >
                {ti.label}
              </button>
            ))}
          </div>
        </div>

        {performance && performance.valueHistory.length > 1 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Return ({perfInterval})</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    performance.percentageReturn >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {performance.percentageReturn >= 0 ? '+' : ''}
                  {formatPercent(performance.percentageReturn)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Absolute Return</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    performance.absoluteReturn >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {performance.absoluteReturn >= 0 ? '+' : ''}
                  {formatCurrency(performance.absoluteReturn)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Unrealized</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    performance.unrealizedGains >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(performance.unrealizedGains)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Realized</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    (realizedGains ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(realizedGains ?? 0)}
                </p>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performance.valueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={11}
                    tickFormatter={(d) => formatDate(d)}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '12px',
                    }}
                    labelFormatter={(d) => formatDate(d)}
                    formatter={(value: number) => [formatCurrency(value), 'Value']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <Link
                to="/performance"
                className="text-sm text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
              >
                View detailed performance
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-surface-500">
            <p>Add transactions to see performance data</p>
          </div>
        )}
      </Card>

      {/* Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="animate-slide-up">
          <h2 className="text-lg font-semibold text-surface-100 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Top Performers
          </h2>
          {topPerformers && topPerformers.length > 0 ? (
            <div className="space-y-4">
              {topPerformers.map((holding, index) => (
                <div
                  key={holding.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-surface-100">
                        {holding.symbol}
                      </p>
                      <p className="text-xs text-surface-500">{holding.name}</p>
                    </div>
                  </div>
                  <span className="text-green-400 font-medium tabular-nums">
                    +{formatPercent(holding.gainPercent)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-center py-8">
              No performance data yet
            </p>
          )}
        </Card>

        {/* Worst Performers */}
        <Card className="animate-slide-up animate-delay-100">
          <h2 className="text-lg font-semibold text-surface-100 mb-6 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Worst Performers
          </h2>
          {worstPerformers && worstPerformers.length > 0 ? (
            <div className="space-y-4">
              {worstPerformers.map((holding, index) => (
                <div
                  key={holding.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-surface-100">
                        {holding.symbol}
                      </p>
                      <p className="text-xs text-surface-500">{holding.name}</p>
                    </div>
                  </div>
                  <span className="text-red-400 font-medium tabular-nums">
                    {formatPercent(holding.gainPercent)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-center py-8">
              No performance data yet
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
