import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { clsx } from 'clsx';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
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
  usePortfolioBreakdown,
  useRealizedGainsTotal,
  useExchangeRate,
} from '../api/hooks';
import type { AllocDimension } from '../api/hooks';
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../lib/format';
import CurrencyValue from '../components/CurrencyValue';
import type { TimeInterval, DimensionSlice } from '../api/types';

const DIMENSION_TABS: { value: AllocDimension; label: string }[] = [
  { value: 'byRiskProfile', label: 'Risk Profile' },
  { value: 'byAssetClass', label: 'Asset Class' },
  { value: 'bySubCategory', label: 'Sub-Category' },
  { value: 'byInstrumentType', label: 'Instrument' },
  { value: 'byGeography', label: 'Geography' },
  { value: 'byLiquidity', label: 'Liquidity' },
  { value: 'byCurrency', label: 'Currency' },
  { value: 'byOwnership', label: 'Ownership' },
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

function AllocTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill?: string } }> }) {
  if (!active || !payload?.[0]) return null;
  const { name, value, payload: item } = payload[0];
  const color = item.fill || '#3b82f6';
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 shadow-xl text-sm"
      style={{
        backgroundColor: '#18181b',
        border: `1px solid ${color}50`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}25`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-medium text-surface-200">{name}</span>
      </div>
      <span className="text-surface-100 font-semibold tabular-nums" style={{ color }}>
        {formatCurrency(value, 'INR')}
      </span>
    </div>
  );
}

const isIndianSymbol = (s: string) => s.endsWith('.NS') || s.endsWith('.BO');

const METAL_CLASSES = new Set(['gold', 'gold_physical', 'silver', 'silver_physical', 'metals']);
const CASH_EQUIV_CLASSES = new Set(['cash', 'fixed_deposit', 'lended', 'bonds']);
const GOV_SCHEME_CLASSES = new Set(['ppf', 'epf', 'nps']);
const MF_CLASSES = new Set(['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt']);

function getDimensionLabel(dimension: AllocDimension, assetClass: string, symbol: string, currency: string): string {
  const indian = isIndianSymbol(symbol);
  switch (dimension) {
    case 'byAssetClass':
      switch (assetClass) {
        case 'stocks': return 'Stocks';
        case 'etf': return 'ETF';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Fund';
        case 'gold': return 'Gold';
        case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver';
        case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'bySubCategory':
      switch (assetClass) {
        case 'stocks': return indian ? 'Indian Stocks' : 'US Stocks';
        case 'etf': return indian ? 'Indian ETFs' : 'US ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': return 'MF Equity';
        case 'mutual_fund_debt': return 'MF Debt';
        case 'gold': return 'Gold ETF'; case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver ETF'; case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'byGeography':
      if (METAL_CLASSES.has(assetClass)) return 'Metals';
      if (CASH_EQUIV_CLASSES.has(assetClass)) return 'Cash & Equivalents';
      if (assetClass === 'real_estate' || assetClass === 'vehicle') return 'Physical Assets';
      if (assetClass === 'crypto') return 'Crypto';
      if (assetClass === 'external_portfolio') return 'External';
      if (GOV_SCHEME_CLASSES.has(assetClass) || MF_CLASSES.has(assetClass)) return 'India';
      return indian ? 'India' : 'International';
    case 'byInstrumentType':
      switch (assetClass) {
        case 'stocks': return 'Equities';
        case 'etf': return 'ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Funds';
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical': case 'metals': return 'Commodities';
        case 'ppf': case 'epf': case 'nps': return 'Gov Schemes';
        case 'fixed_deposit': case 'bonds': return 'Fixed Income';
        case 'crypto': return 'Crypto'; case 'lended': return 'Lended';
        case 'cash': return 'Cash';
        case 'real_estate': case 'vehicle': return 'Physical Assets';
        case 'external_portfolio': return 'External Portfolio';
        default: return 'Other';
      }
    case 'byRiskProfile':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical':
        case 'metals': case 'crypto':
        case 'external_portfolio':
          return 'Growth Investment';
        case 'mutual_fund_debt': case 'bonds': case 'fixed_deposit':
          return 'Protective Investment';
        case 'lended': return 'Lended';
        case 'epf': case 'ppf': case 'nps': return 'Retirement';
        case 'real_estate': case 'vehicle': return 'Physical Asset';
        case 'cash': return 'Cash';
        default: return 'Other';
      }
    case 'byLiquidity':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'mutual_fund_debt': case 'crypto': case 'cash': case 'bonds':
        case 'fixed_deposit': case 'external_portfolio':
        case 'gold': case 'silver': case 'metals':
          return 'Liquid';
        case 'gold_physical': case 'silver_physical':
        case 'ppf': case 'epf': case 'nps':
        case 'lended': case 'real_estate': case 'vehicle':
          return 'Non-Liquid';
        default: return 'Other';
      }
    case 'byCurrency':
      return currency || 'INR';
    case 'byOwnership':
      return assetClass === 'external_portfolio' ? "Dad's Portfolio" : 'My Portfolio';
  }
}

const TIME_INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'YTD', label: 'YTD' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [perfInterval, setPerfInterval] = useState<TimeInterval>('1M');
  const [allocDimension, setAllocDimension] = useState<AllocDimension>('byRiskProfile');
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: multiAlloc, isLoading: allocationLoading } = useMultiDimensionalAllocation();
  const { data: holdings } = usePortfolioHoldings();
  const { data: topPerformers } = useTopPerformers(5);
  const { data: worstPerformers } = useWorstPerformers(5);
  const { data: performance } = usePortfolioPerformance(perfInterval);
  const { data: breakdownSeries } = usePortfolioBreakdown(perfInterval, allocDimension);
  const { data: realizedGains } = useRealizedGainsTotal();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = summary?.usdToInr ?? usdInrRate?.rate ?? null;

  // Extract unique category keys from breakdown series, ordered by final-date value
  const breakdownCategories = useMemo(() => {
    if (!breakdownSeries || breakdownSeries.length === 0) return [];
    const last = breakdownSeries[breakdownSeries.length - 1];
    const keys = Object.keys(last).filter((k) => k !== 'date' && k !== 'total');
    return keys.sort((a, b) => ((last[b] as number) ?? 0) - ((last[a] as number) ?? 0));
  }, [breakdownSeries]);

  // Map category name → color, matching the allocation pie slices
  const categoryColorMap = useMemo(() => {
    const slices: DimensionSlice[] = multiAlloc?.[allocDimension] ?? [];
    const map = new Map<string, string>();
    slices.forEach((s, idx) => map.set(s.label, getSliceColor(idx)));
    return map;
  }, [multiAlloc, allocDimension]);

  const filteredHoldings = useMemo(() => {
    if (!holdings) return [];
    if (!selectedSlice) return holdings;
    return holdings.filter((h) =>
      getDimensionLabel(allocDimension, h.assetClass, h.symbol, h.currency) === selectedSlice
    );
  }, [holdings, selectedSlice, allocDimension]);

  const filteredTop5 = useMemo(() => {
    const source = selectedSlice ? filteredHoldings : (topPerformers ?? []);
    if (selectedSlice) {
      return [...source].sort((a, b) => b.gainPercent - a.gainPercent).slice(0, 5);
    }
    return source;
  }, [filteredHoldings, topPerformers, selectedSlice]);

  const filteredWorst5 = useMemo(() => {
    const source = selectedSlice ? filteredHoldings : (worstPerformers ?? []);
    if (selectedSlice) {
      return [...source].sort((a, b) => a.gainPercent - b.gainPercent).slice(0, 5);
    }
    return source;
  }, [filteredHoldings, worstPerformers, selectedSlice]);

  const handleDimensionChange = (dim: AllocDimension) => {
    setAllocDimension(dim);
    setSelectedSlice(null);
  };

  const handleSliceClick = (label: string) => {
    setSelectedSlice((prev) => (prev === label ? null : label));
  };

  const handleViewHoldings = () => {
    if (selectedSlice) {
      navigate(`/assets?dimension=${allocDimension}&label=${encodeURIComponent(selectedSlice)}`);
    } else {
      navigate('/assets');
    }
  };

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
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
        <p className="text-sm text-surface-500">
          {summary.holdingCount} holdings across {summary.assetCount} assets
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-8 pr-1">
      {/* Summary Stats */}
      {usdToInr && (
        <p className="text-xs text-surface-500 text-right tabular-nums -mb-6">
          1 USD = {formatCurrency(usdToInr, 'INR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Value"
          value={formatCurrency(summary.totalValue, 'INR')}
          usdSubValue={usdToInr ? formatCurrency(summary.totalValue / usdToInr, 'USD') : undefined}
          icon={DollarSign}
          variant="brand"
          className="animate-slide-up"
        />
        <StatCard
          label="Current Invested"
          value={formatCurrency(summary.totalCost, 'INR')}
          usdSubValue={usdToInr ? formatCurrency(summary.totalCost / usdToInr, 'USD') : undefined}
          icon={Wallet}
          variant="brand"
          className="animate-slide-up animate-delay-100"
        />
        <StatCard
          label="Total P&L"
          value={`${isPositive ? '+' : ''}${formatCurrency(summary.totalGain, 'INR')}`}
          usdSubValue={usdToInr ? `${isPositive ? '+' : ''}${formatCurrency(summary.totalGain / usdToInr, 'USD')}` : undefined}
          icon={isPositive ? TrendingUp : TrendingDown}
          isPositive={isPositive}
          className="animate-slide-up animate-delay-200"
        />
        <StatCard
          label="P&L %"
          value={`${isPositive ? '+' : ''}${formatPercent(summary.totalGainPercent)}`}
          usdSubValue={`${isPositive ? '+' : ''}${formatCurrency(summary.totalGain, 'INR')}`}
          subValue={`on ${formatCurrency(summary.totalCost, 'INR')} invested`}
          icon={isPositive ? TrendingUp : TrendingDown}
          isPositive={isPositive}
          className="animate-slide-up animate-delay-300"
        />
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
                onClick={() => handleDimensionChange(tab.value)}
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
                        cursor="pointer"
                        onClick={(_, idx) => handleSliceClick(slices[idx].label)}
                      >
                        {slices.map((s, idx) => (
                          <Cell
                            key={idx}
                            fill={getSliceColor(idx)}
                            opacity={selectedSlice && selectedSlice !== s.label ? 0.3 : 1}
                            stroke={selectedSlice === s.label ? '#fff' : 'none'}
                            strokeWidth={selectedSlice === s.label ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<AllocTooltip />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-3 max-h-64 overflow-y-auto">
                  {slices.map((item, idx) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSliceClick(item.label)}
                      className={clsx(
                        'flex items-center justify-between w-full px-2 py-1 rounded-md transition-colors text-left',
                        selectedSlice === item.label
                          ? 'bg-brand-600/20 ring-1 ring-brand-500/40'
                          : 'hover:bg-surface-800/50',
                        selectedSlice && selectedSlice !== item.label && 'opacity-40'
                      )}
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
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>

        {/* Holdings Table */}
        <Card className="lg:col-span-2 animate-slide-up animate-delay-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-surface-100">
              Holdings Overview
              {selectedSlice && (
                <span className="text-sm font-normal text-brand-400 ml-2">
                  — {selectedSlice}
                </span>
              )}
            </h2>
            {selectedSlice && (
              <button
                type="button"
                onClick={() => setSelectedSlice(null)}
                className="text-xs text-surface-400 hover:text-surface-200 transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
          {filteredHoldings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="table-header">Asset</th>
                    <th className="table-header text-right">Quantity</th>
                    <th className="table-header text-right">Value</th>
                    <th className="table-header text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {filteredHoldings.slice(0, 10).map((holding) => (
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
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={handleViewHoldings}
                  className="text-sm text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
                >
                  View {selectedSlice ? filteredHoldings.length : 'all'} holdings
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-surface-500 text-center py-8">No holdings{selectedSlice ? ' in this category' : ' yet'}</p>
          )}
        </Card>
      </div>

      {/* Top & Worst Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Top Performers
              {selectedSlice && (
                <span className="text-sm font-normal text-brand-400">— {selectedSlice}</span>
              )}
            </h2>
          </div>
          {filteredTop5.length > 0 ? (
            <div className="space-y-4">
              {filteredTop5.map((holding, index) => (
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
              No {selectedSlice ? 'holdings in this category' : 'performance data yet'}
            </p>
          )}
        </Card>

        {/* Worst Performers */}
        <Card className="animate-slide-up animate-delay-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Worst Performers
              {selectedSlice && (
                <span className="text-sm font-normal text-brand-400">— {selectedSlice}</span>
              )}
            </h2>
          </div>
          {filteredWorst5.length > 0 ? (
            <div className="space-y-4">
              {filteredWorst5.map((holding, index) => (
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
              No {selectedSlice ? 'holdings in this category' : 'performance data yet'}
            </p>
          )}
        </Card>
      </div>

      {/* Performance Chart */}
      <Card className="animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-400" />
            Portfolio Performance
            {selectedSlice && (
              <span className="text-sm font-normal text-brand-400">— {selectedSlice}</span>
            )}
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
                <p className="text-xs text-surface-500 mb-1">P&L % ({perfInterval})</p>
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
                <p className="text-xs text-surface-500 mb-1">Total P&L</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    performance.absoluteReturn >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {performance.absoluteReturn >= 0 ? '+' : ''}
                  {formatCurrency(performance.absoluteReturn, 'INR')}
                </p>
                {usdToInr && (
                  <p className={clsx('text-[10px]', performance.absoluteReturn >= 0 ? 'text-green-400/60' : 'text-red-400/60')}>
                    {performance.absoluteReturn >= 0 ? '+' : ''}{formatCurrency(performance.absoluteReturn / usdToInr, 'USD')}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Unrealized P&L</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    performance.unrealizedGains >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(performance.unrealizedGains, 'INR')}
                </p>
                {usdToInr && (
                  <p className={clsx('text-[10px]', performance.unrealizedGains >= 0 ? 'text-green-400/60' : 'text-red-400/60')}>
                    {formatCurrency(performance.unrealizedGains / usdToInr, 'USD')}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30">
                <p className="text-xs text-surface-500 mb-1">Realized P&L</p>
                <p
                  className={clsx(
                    'text-lg font-bold',
                    (realizedGains ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {formatCurrency(realizedGains ?? 0, 'INR')}
                </p>
                {usdToInr && (
                  <p className={clsx('text-[10px]', (realizedGains ?? 0) >= 0 ? 'text-green-400/60' : 'text-red-400/60')}>
                    {formatCurrency((realizedGains ?? 0) / usdToInr, 'USD')}
                  </p>
                )}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {breakdownSeries && breakdownSeries.length > 1 && breakdownCategories.length > 0 ? (
                  <AreaChart data={breakdownSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickFormatter={(d) => formatDate(d)} />
                    <YAxis stroke="#52525b" fontSize={11} tickFormatter={(v) => {
                      if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
                      if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                      return `₹${(v / 1000).toFixed(0)}k`;
                    }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 12 }}
                      labelFormatter={(d) => formatDate(d)}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, 'INR'),
                        name === 'total' ? 'Total' : name,
                      ]}
                    />
                    <Legend
                      formatter={(v) => v === 'total' ? 'Total' : v}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    {breakdownCategories.map((cat) => {
                      const color = categoryColorMap.get(cat) ?? '#6366f1';
                      const dimmed = selectedSlice && selectedSlice !== cat;
                      return (
                        <Area
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stroke={color}
                          fill={color}
                          fillOpacity={dimmed ? 0.03 : 0.15}
                          strokeWidth={dimmed ? 0.5 : 1.5}
                          strokeOpacity={dimmed ? 0.25 : 1}
                          dot={false}
                          connectNulls
                        />
                      );
                    })}
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#e4e4e7"
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray={selectedSlice ? '6 3' : undefined}
                      strokeOpacity={selectedSlice ? 0.4 : 1}
                      dot={false}
                      connectNulls
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={performance.valueHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickFormatter={(d) => formatDate(d)} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      }}
                      itemStyle={{ color: '#e4e4e7' }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 12 }}
                      labelFormatter={(d) => formatDate(d)}
                      formatter={(value: number) => [formatCurrency(value, 'INR'), 'Value']}
                    />
                    <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                )}
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
      </div>
    </div>
  );
}
