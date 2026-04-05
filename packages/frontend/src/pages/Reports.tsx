import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  FileBarChart,
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  PiggyBank,
  Printer,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { LoadingPage } from '../components/LoadingSpinner';
import { formatCurrency, todayLocal } from '../lib/format';
import { useReport } from '../api/hooks';
import type { CashFlowMonthSummary } from '../api/types';

type Period = 'monthly' | 'quarterly' | 'yearly';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

function getFYYear(): string {
  const [y, m] = todayLocal().split('-').map(Number);
  return m >= 4 ? String(y) : String(y - 1);
}

function getCurrentMonth(): string {
  return todayLocal().slice(0, 7);
}

function getCurrentQuarter(): string {
  const [y, m] = todayLocal().split('-').map(Number);
  const fy = m >= 4 ? y : y - 1;
  if (m >= 4 && m <= 6) return `${fy}-Q1`;
  if (m >= 7 && m <= 9) return `${fy}-Q2`;
  if (m >= 10 && m <= 12) return `${fy}-Q3`;
  return `${fy}-Q4`;
}

function shortMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-IN', { month: 'short' });
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [monthInput, setMonthInput] = useState(getCurrentMonth());
  const [quarterInput, setQuarterInput] = useState(getCurrentQuarter());
  const [yearInput, setYearInput] = useState(getFYYear());

  const startParam = period === 'monthly' ? monthInput : period === 'quarterly' ? quarterInput : yearInput;
  const { data, isLoading } = useReport(period, startParam);

  const report = data as Record<string, unknown> | undefined;

  const monthDetails = (report?.monthDetails ?? report?.cashFlow ? [report.cashFlow] : []) as CashFlowMonthSummary[];

  const aggregate = report?.aggregate as { totalIncome: number; totalExpenses: number; totalInvested: number; totalSavings: number } | undefined;
  const portfolio = report?.portfolio as { totalValue: number; totalCost: number; unrealizedGain: number } | undefined;

  const monthlyForChart = useMemo(() => {
    if (!monthDetails || monthDetails.length <= 1) return null;
    return monthDetails.map((m) => ({
      month: shortMonthLabel(m.month),
      income: m.totals.totalIncome,
      expenses: m.totals.totalExpenses,
      investment: m.totals.totalInvested,
      savings: m.totals.savings,
    }));
  }, [monthDetails]);

  const expenseBreakdown = useMemo(() => {
    if (!monthDetails || monthDetails.length === 0) return [];
    const catMap = new Map<string, number>();
    for (const m of monthDetails) {
      for (const row of m.expenses) {
        const existing = catMap.get(row.categoryName) ?? 0;
        catMap.set(row.categoryName, existing + (row.actual ?? 0));
      }
    }
    return Array.from(catMap, ([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [monthDetails]);

  // Derive aggregate from single month if needed
  const effectiveAggregate = aggregate ?? (monthDetails.length === 1 ? {
    totalIncome: monthDetails[0].totals.totalIncome,
    totalExpenses: monthDetails[0].totals.totalExpenses,
    totalInvested: monthDetails[0].totals.totalInvested,
    totalSavings: monthDetails[0].totals.savings,
  } : null);

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-6 h-6 text-brand-400" />
          <h1 className="text-2xl font-bold text-surface-100">Reports</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary text-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> Print / Export
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">

      {/* Period Selector */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                period === p ? 'bg-brand-600 text-white' : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <Calendar className="w-4 h-4 text-surface-500" />
            {period === 'monthly' && (
              <input
                type="month"
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              />
            )}
            {period === 'quarterly' && (
              <select
                value={quarterInput}
                onChange={(e) => setQuarterInput(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              >
                {Array.from({ length: 4 }, (_, i) => {
                  const fy = getFYYear();
                  const q = `${fy}-Q${i + 1}`;
                  const labels = ['Apr–Jun', 'Jul–Sep', 'Oct–Dec', 'Jan–Mar'];
                  return <option key={q} value={q}>Q{i + 1} ({labels[i]})</option>;
                })}
              </select>
            )}
            {period === 'yearly' && (
              <select
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = parseInt(getFYYear()) - i;
                  return <option key={y} value={y}>FY {y}–{y + 1}</option>;
                })}
              </select>
            )}
          </div>
        </div>
      </Card>

      {isLoading && <LoadingPage />}

      {!isLoading && effectiveAggregate && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Income"
              value={formatCurrency(effectiveAggregate.totalIncome, 'INR')}
              icon={DollarSign}
              variant="brand"
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(effectiveAggregate.totalExpenses, 'INR')}
              icon={ShoppingCart}
              isPositive={false}
            />
            <StatCard
              label="Total Investment"
              value={formatCurrency(effectiveAggregate.totalInvested, 'INR')}
              icon={TrendingUp}
              variant="brand"
            />
            <StatCard
              label="Savings"
              value={formatCurrency(effectiveAggregate.totalSavings, 'INR')}
              icon={PiggyBank}
              isPositive={effectiveAggregate.totalSavings >= 0}
            />
          </div>

          {/* Portfolio Overview */}
          {portfolio && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Portfolio Snapshot</h2>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Portfolio Value</p>
                  <p className="text-xl font-bold text-surface-100">{formatCurrency(portfolio.totalValue, 'INR')}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Total Invested</p>
                  <p className="text-xl font-bold text-surface-300">{formatCurrency(portfolio.totalCost, 'INR')}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Unrealized P&L</p>
                  <p className={clsx('text-xl font-bold', portfolio.unrealizedGain >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {portfolio.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(portfolio.unrealizedGain, 'INR')}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Month-over-month chart (quarterly/yearly) */}
          {monthlyForChart && monthlyForChart.length > 1 && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Month-over-Month Breakdown</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyForChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: number, name: string) => [formatCurrency(value, 'INR'), name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#3b82f6" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="investment" fill="#22c55e" name="Investment" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="savings" fill="#eab308" name="Savings" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Expense Breakdown Pie */}
          {expenseBreakdown.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Expense Breakdown</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {expenseBreakdown.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                        formatter={(value: number) => [formatCurrency(value, 'INR'), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {expenseBreakdown.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-surface-300">{item.name}</span>
                      </div>
                      <span className="text-surface-100 font-medium tabular-nums">{formatCurrency(item.value, 'INR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Bank Waterfall (for monthly) */}
          {period === 'monthly' && monthDetails.length === 1 && monthDetails[0].waterfall && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Bank Account Flow</h2>
              <div className="space-y-1.5 text-sm">
                {[
                  { label: 'Opening Bank Balance', value: monthDetails[0].waterfall.openingBalance, color: 'text-brand-400', sign: '' },
                  { label: 'Income', value: monthDetails[0].waterfall.totalIncome, color: 'text-green-400', sign: '+' },
                  { label: 'Cash / UPI / Bank Expenses', value: monthDetails[0].waterfall.cashUpiExpenses, color: 'text-red-400', sign: '−' },
                  { label: 'Credit Card Bill', value: monthDetails[0].waterfall.ccBillTotal, color: 'text-red-400', sign: '−' },
                  { label: 'Investment Transfers', value: monthDetails[0].waterfall.totalInvested, color: 'text-blue-400', sign: '−' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-surface-800 last:border-b-0">
                    <span className="text-surface-400">{row.sign ? `${row.sign} ` : ''}{row.label}</span>
                    <span className={clsx('font-mono font-medium', row.color)}>
                      {row.value != null ? formatCurrency(row.value, 'INR') : '—'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 border-t-2 border-surface-600 mt-1">
                  <span className="text-surface-100 font-semibold">Savings (Closing Balance)</span>
                  <span className={clsx('font-mono font-bold', monthDetails[0].waterfall.savings >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatCurrency(monthDetails[0].waterfall.savings, 'INR')}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Monthly Target vs Actual (for yearly/quarterly) */}
          {monthDetails.length > 1 && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Monthly Summary Table</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      <th className="text-left py-2 px-3 text-xs text-surface-500 uppercase">Month</th>
                      <th className="text-right py-2 px-3 text-xs text-surface-500 uppercase">Income</th>
                      <th className="text-right py-2 px-3 text-xs text-surface-500 uppercase">Expenses</th>
                      <th className="text-right py-2 px-3 text-xs text-surface-500 uppercase">Investment</th>
                      <th className="text-right py-2 px-3 text-xs text-surface-500 uppercase">Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {monthDetails.map((m) => (
                      <tr key={m.month} className="hover:bg-surface-800/40">
                        <td className="py-2 px-3 text-surface-300">{shortMonthLabel(m.month)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-blue-400">{formatCurrency(m.totals.totalIncome, 'INR')}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-red-400">{formatCurrency(m.totals.totalExpenses, 'INR')}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-green-400">{formatCurrency(m.totals.totalInvested, 'INR')}</td>
                        <td className={clsx('py-2 px-3 text-right tabular-nums font-medium', m.totals.savings >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {formatCurrency(m.totals.savings, 'INR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-surface-600 font-semibold">
                      <td className="py-2 px-3 text-surface-100">Total</td>
                      <td className="py-2 px-3 text-right tabular-nums text-blue-400">{formatCurrency(effectiveAggregate.totalIncome, 'INR')}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-red-400">{formatCurrency(effectiveAggregate.totalExpenses, 'INR')}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-green-400">{formatCurrency(effectiveAggregate.totalInvested, 'INR')}</td>
                      <td className={clsx('py-2 px-3 text-right tabular-nums', effectiveAggregate.totalSavings >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {formatCurrency(effectiveAggregate.totalSavings, 'INR')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {!isLoading && !effectiveAggregate && (
        <Card>
          <div className="text-center py-12">
            <FileBarChart className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400">No data for the selected period. Try a different date range.</p>
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}
