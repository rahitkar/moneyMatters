import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  Trash2,
  Settings,
  Target,
  TrendingUp,
  DollarSign,
  Wallet,
  ShoppingCart,
  Sparkles,
  X,
  RefreshCw,
  CreditCard,
  Calendar,
  Landmark,
  Pencil,
  Check,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  AreaChart,
  Area,
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
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { LoadingPage } from '../components/LoadingSpinner';
import { formatCurrency, todayLocal } from '../lib/format';
import {
  useCashFlowSummary,
  useCashFlowCategories,
  useCashFlowYearly,
  useCashFlowSettings,
  useUpdateCashFlowSettings,
  useUpsertMonthConfig,
  useCreateCategory,
  useDeleteCategory,
  useUpsertEntry,
  useUpdateEntry,
  useInitMonth,
  useGoalTargets,
  useGoalProjection,
  useCreateTarget,
  useDeleteTarget,
  useFireCompare,
  usePaymentMethods,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  useAddSpend,
  useDeleteSpend,
  useUpdateSpend,
  usePositions,
  useExchangeRate,
  useSyncPreview,
  useSyncToPortfolio,
  usePayCcBill,
} from '../api/hooks';
import type {
  CashFlowCategory,
  CashFlowSpend,
  ExpenseTag,
  PaymentMethod,
  PaymentMethodType,
  PaymentMethodBreakdownRow,
  NetWorthTarget,
} from '../api/types';

const PM_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

const FIRE_COLORS = ['#22c55e', '#eab308', '#3b82f6', '#a855f7', '#f97316'];

// ── Helpers ───────────────────────────────────────────────────────

function getCurrentMonth(cycleStartDay = 1): string {
  const [y, m, day] = todayLocal().split('-').map(Number);
  if (cycleStartDay >= 2 && day >= cycleStartDay) {
    const next = new Date(y, m, 1); // m is already 1-based, so month+1 in Date()
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getCycleDateRange(month: string, cycleStartDay: number): { start: string; end: string } | null {
  if (cycleStartDay <= 1) return null;
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = prevDate.getMonth() + 1;
  return {
    start: `${prevY}-${String(prevM).padStart(2, '0')}-${String(cycleStartDay).padStart(2, '0')}`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(cycleStartDay - 1).padStart(2, '0')}`,
  };
}

function formatCycleRange(month: string, cycleStartDay: number): string {
  const range = getCycleDateRange(month, cycleStartDay);
  if (!range) return '';
  const s = new Date(range.start + 'T00:00:00');
  const e = new Date(range.end + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function getFYYear(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m >= 4 ? String(y) : String(y - 1);
}

function getFYMonths(year: string): string[] {
  const y = parseInt(year, 10);
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${y + 1}-${String(m).padStart(2, '0')}`);
  return months;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const date = new Date(parseInt(y), parseInt(mo) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function shortMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-IN', { month: 'short' });
}

// ── Page ──────────────────────────────────────────────────────────

export default function CashFlow() {
  const { data: cfSettings } = useCashFlowSettings();
  const cycleStartDay = cfSettings?.cycleStartDay ?? 1;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [cycleInitialized, setCycleInitialized] = useState(false);
  const [filterPmId, setFilterPmId] = useState<string | null>(null);

  useEffect(() => {
    if (cycleStartDay > 1 && !cycleInitialized) {
      setSelectedMonth(getCurrentMonth(cycleStartDay));
      setCycleInitialized(true);
    }
  }, [cycleStartDay, cycleInitialized]);

  const fyYear = getFYYear(selectedMonth);
  const fyMonths = useMemo(() => getFYMonths(fyYear), [fyYear]);

  const { data: summary, isLoading } = useCashFlowSummary(selectedMonth);
  const { data: categories } = useCashFlowCategories();
  const { data: yearly } = useCashFlowYearly(fyYear);
  const { data: targets } = useGoalTargets();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: allPositions } = usePositions();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;
  const cashPositions = useMemo(
    () => allPositions?.filter((p) => p.assetClass === 'cash' && p.quantity !== 0) ?? [],
    [allPositions],
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showPMModal, setShowPMModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [expenseLimitInput, setExpenseLimitInput] = useState('');
  const [investmentTargetInput, setInvestmentTargetInput] = useState('');

  const upsertConfig = useUpsertMonthConfig();
  const initMonth = useInitMonth();

  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showCcPayDialog, setShowCcPayDialog] = useState(false);
  const { data: syncPreview, refetch: refetchSyncPreview } = useSyncPreview(selectedMonth, showSyncDialog);
  const syncToPortfolio = useSyncToPortfolio();
  const payCcBill = usePayCcBill();

  const hasData = summary && (summary.expenses.length > 0 || summary.income.totalIncome > 0 || summary.spends.length > 0);
  const hasCategories = categories && categories.length > 0;

  const activeTarget = targets?.find((t) => t.isActive);
  const { data: projection } = useGoalProjection(activeTarget?.id ?? null);

  const { data: fireComparison } = useFireCompare();

  if (isLoading) return <LoadingPage />;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Cash Flow</h1>
          <p className="text-surface-500 text-sm mt-1">
            FY {fyYear}-{String(parseInt(fyYear) + 1).slice(2)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTargetModal(true)} className="btn btn-secondary text-sm">
            <Target className="w-4 h-4" /> Goals
          </button>
          <button onClick={() => setShowPMModal(true)} className="btn btn-secondary text-sm">
            <CreditCard className="w-4 h-4" /> Payment Methods
          </button>
          <button onClick={() => setShowCategoryModal(true)} className="btn btn-secondary text-sm">
            <Settings className="w-4 h-4" /> Categories
          </button>
          <button onClick={() => setShowSettingsModal(true)} className="btn btn-secondary text-sm" title="Billing cycle settings">
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">

      {/* Month Selector */}
      <Card padding="sm">
        <div className="flex items-center gap-1 flex-wrap">
          {fyMonths.map((m) => (
            <button
              key={m}
              onClick={() => { setSelectedMonth(m); setFilterPmId(null); }}
              className={clsx(
                'px-3 py-1.5 rounded-lg font-medium transition-colors flex flex-col items-center',
                selectedMonth === m
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50',
              )}
            >
              <span className="text-sm">{shortMonthLabel(m)}</span>
              {cycleStartDay > 1 && (
                <span className={clsx('text-[9px] leading-tight', selectedMonth === m ? 'text-white/70' : 'text-surface-600')}>
                  {formatCycleRange(m, cycleStartDay)}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Onboarding / Empty state */}
      {!hasCategories && (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Set up your cash flow"
            description="Start by adding expense categories (rent, groceries, CC bills, etc.), then set your monthly salary."
          />
          <div className="flex justify-center mt-4">
            <button onClick={() => setShowCategoryModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Add Categories
            </button>
          </div>
        </Card>
      )}

      {hasCategories && !hasData && (
        <Card>
          <div className="text-center py-6">
            <p className="text-surface-400 mb-4">No data for {monthLabel(selectedMonth)} yet.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  initMonth.mutate(selectedMonth);
                  setEditingConfig(true);
                }}
                className="btn btn-primary text-sm"
              >
                Initialize {monthLabel(selectedMonth)}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Salary & targets bar */}
      {hasCategories && (
        <Card padding="sm">
          {editingConfig ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                upsertConfig.mutate({
                  month: selectedMonth,
                  openingBalance: openingBalanceInput ? parseFloat(openingBalanceInput) : undefined,
                  expenseLimit: expenseLimitInput ? parseFloat(expenseLimitInput) : undefined,
                  investmentTarget: investmentTargetInput ? parseFloat(investmentTargetInput) : undefined,
                });
                setEditingConfig(false);
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div>
                  <label className="block text-[10px] text-surface-500 mb-0.5">Current Bank Balance</label>
                  <input type="number" value={openingBalanceInput} onChange={(e) => setOpeningBalanceInput(e.target.value)} placeholder="Current balance"
                    className="w-40 px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" autoFocus />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 mb-0.5">Expense Limit</label>
                  <input type="number" value={expenseLimitInput} onChange={(e) => setExpenseLimitInput(e.target.value)} placeholder="Max expenses"
                    className="w-32 px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 mb-0.5">Inv. Target</label>
                  <input type="number" value={investmentTargetInput} onChange={(e) => setInvestmentTargetInput(e.target.value)} placeholder="Min investment"
                    className="w-32 px-3 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
                </div>
                <div className="flex items-end gap-1 pt-4">
                  <button type="submit" className="btn btn-primary text-xs px-3 py-1.5">Save</button>
                  <button type="button" onClick={() => setEditingConfig(false)} className="text-surface-500 hover:text-surface-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setOpeningBalanceInput(summary?.income.openingBalanceAutoCarried ? '' : String(summary?.income.openingBalance ?? ''));
                  setExpenseLimitInput(String(summary?.income.expenseLimit ?? ''));
                  setInvestmentTargetInput(String(summary?.income.investmentTarget ?? ''));
                  setEditingConfig(true);
                }}
                className="text-surface-100 font-semibold hover:text-brand-400 transition-colors flex items-center gap-2"
              >
                <Landmark className="w-4 h-4 text-brand-400" />
                {summary?.income.openingBalance != null
                  ? `Bank: ${formatCurrency(summary.income.openingBalance, 'INR')}`
                  : 'Set Opening Balance'}
                {summary?.income.openingBalanceAutoCarried && (
                  <span className="text-surface-500 text-[10px] font-normal">(auto)</span>
                )}
              </button>
              {(summary?.income?.totalIncome ?? 0) > 0 && (
                <span className="text-surface-500 text-xs flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Income: {formatCurrency(summary!.income.totalIncome, 'INR')}
                </span>
              )}
              {cycleStartDay > 1 && summary?.cycleStart && (
                <span className="text-surface-600 text-xs ml-auto">
                  Cycle: {new Date(summary.cycleStart + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(summary.cycleEnd + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Summary Stat Cards */}
      {summary && hasData && (
        <>
          {/* Bank Waterfall */}
          <Card padding="sm">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Bank Account Flow</h3>
            {(() => {
              const ob = summary.waterfall.openingBalance ?? 0;
              const bi = summary.waterfall.bankInvestments ?? 0;
              const wt = summary.waterfall.walletTransfers ?? 0;
              const currentBankBalance = ob + summary.waterfall.totalIncome - bi - wt - summary.waterfall.cashUpiExpenses;
              return (
                <div className="space-y-1.5 text-sm">
                  {[
                    { label: summary.income.openingBalanceAutoCarried ? 'Opening Bank Balance (carried forward)' : 'Opening Bank Balance', value: summary.waterfall.openingBalance, color: 'text-brand-400', sign: '' },
                    { label: 'Income (Salary + Other)', value: summary.waterfall.totalIncome, color: 'text-green-400', sign: '+' },
                    ...(bi > 0 ? [{ label: 'Investment Transfers', value: bi, color: 'text-blue-400', sign: '−' }] : []),
                    ...(wt > 0 ? [{ label: 'Wallet / Broker Transfers', value: wt, color: 'text-purple-400', sign: '−' }] : []),
                    { label: 'Cash / UPI / Bank Expenses', value: summary.waterfall.cashUpiExpenses, color: 'text-red-400', sign: '−' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-1 border-b border-surface-800 last:border-b-0">
                      <span className="text-surface-400">{row.sign ? `${row.sign} ` : ''}{row.label}</span>
                      <span className={clsx('font-mono font-medium', row.color)}>
                        {row.value != null ? formatCurrency(row.value, 'INR') : '—'}
                      </span>
                    </div>
                  ))}
                  {summary.waterfall.openingBalance != null && (
                    <div className="flex items-center justify-between py-2 border-t-2 border-brand-500/30 bg-brand-500/5 rounded-lg px-2 -mx-1 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-brand-400 font-semibold text-xs uppercase tracking-wide">Current Bank Balance</span>
                        <button
                          onClick={() => { setShowSyncDialog(true); refetchSyncPreview(); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 transition-colors"
                          title="Sync this balance to your portfolio"
                        >
                          <RefreshCw className="w-3 h-3 inline -mt-px mr-0.5" />Sync
                        </button>
                      </div>
                      <span className={clsx('font-mono font-bold text-base', currentBankBalance >= 0 ? 'text-brand-400' : 'text-red-400')}>
                        {formatCurrency(currentBankBalance, 'INR')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1 border-b border-surface-800">
                    <div className="flex items-center gap-2">
                      <span className="text-surface-400">− Credit Card Spends</span>
                      {summary.waterfall.ccBillTotal > 0 && (
                        <button
                          onClick={() => setShowCcPayDialog(true)}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                          title="Pay CC bill from savings account"
                        >
                          Pay Bill
                        </button>
                      )}
                    </div>
                    <span className="font-mono font-medium text-red-400">
                      {summary.waterfall.ccBillTotal != null ? formatCurrency(summary.waterfall.ccBillTotal, 'INR') : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-t-2 border-surface-600 mt-1">
                    <span className="text-surface-100 font-semibold">Savings (Closing Balance)</span>
                    <span className={clsx('font-mono font-bold', summary.waterfall.savings >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {formatCurrency(summary.waterfall.savings, 'INR')}
                    </span>
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Income"
              value={formatCurrency(summary.totals.totalIncome, 'INR')}
              icon={DollarSign}
              variant="brand"
            />
            <StatCard
              label="Expenses"
              value={formatCurrency(summary.totals.totalExpenses, 'INR')}
              subValue={summary.income.expenseLimit ? `Limit: ${formatCurrency(summary.income.expenseLimit, 'INR')}` : undefined}
              icon={ShoppingCart}
              variant="negative"
            />
            <StatCard
              label="Investment"
              value={formatCurrency(summary.totals.totalInvested, 'INR')}
              subValue={`${summary.totals.investmentPct.toFixed(1)}% of income`}
              icon={TrendingUp}
              variant="brand"
            />
            <StatCard
              label="Need"
              value={formatCurrency(summary.totals.totalNeed, 'INR')}
              subValue={`${summary.totals.needPct.toFixed(1)}% of income`}
              icon={ShoppingCart}
              variant="negative"
            />
            <StatCard
              label="Luxury"
              value={formatCurrency(summary.totals.totalLuxury, 'INR')}
              subValue={`${summary.totals.luxuryPct.toFixed(1)}% of income`}
              icon={Sparkles}
              variant="negative"
            />
          </div>

          {/* Add Spend Form */}
          {categories && categories.length > 0 && paymentMethods && paymentMethods.length > 0 && (
            <AddSpendForm categories={categories} paymentMethods={paymentMethods} month={selectedMonth} />
          )}
          {paymentMethods && paymentMethods.length === 0 && (
            <Card padding="sm">
              <div className="flex items-center justify-between">
                <p className="text-surface-400 text-sm">Add payment methods (Cash, Credit Cards, UPI, etc.) to start logging individual expenses.</p>
                <button onClick={() => setShowPMModal(true)} className="btn btn-primary text-sm">
                  <CreditCard className="w-4 h-4" /> Add Payment Methods
                </button>
              </div>
            </Card>
          )}

          {/* Spend Log + Payment Method Breakdown */}
          {summary.spends.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SpendLog spends={summary.spends} categories={categories ?? []} paymentMethods={paymentMethods ?? []} filterPmId={filterPmId} />
              </div>
              <PaymentBreakdown breakdown={summary.paymentMethodBreakdown} selectedId={filterPmId} onSelect={setFilterPmId} />
            </div>
          )}

          {/* Expense Table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-100">
                Monthly Expenses — {monthLabel(selectedMonth)}
              </h2>
              <button
                onClick={() => initMonth.mutate(selectedMonth)}
                disabled={initMonth.isPending}
                className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                title="Sync new categories into this month"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', initMonth.isPending && 'animate-spin')} />
                {initMonth.isPending ? 'Syncing...' : 'Sync'}
              </button>
            </div>
            <ExpenseTable
              expenses={summary.expenses}
              salary={summary.income.totalIncome}
              month={selectedMonth}
            />
          </Card>

          {/* Investment Breakdown & Wallet Balances side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {summary.investments.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-surface-100 mb-4">Investment Breakdown</h2>
                <div className="space-y-2">
                  {summary.investments.map((inv) => (
                    <div key={inv.assetId} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-surface-300 text-sm">{inv.name}</span>
                        {inv.currency !== 'INR' && inv.foreignQuantity != null && (
                          <span className="text-surface-500 text-xs">{formatCurrency(inv.foreignQuantity, inv.currency)}</span>
                        )}
                      </div>
                      <span className="text-surface-100 font-medium tabular-nums">{formatCurrency(inv.amount, 'INR')}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 font-semibold">
                    <span className="text-surface-300">Total Invested</span>
                    <span className="text-brand-400 tabular-nums">{formatCurrency(summary.totals.totalInvested, 'INR')}</span>
                  </div>
                </div>
              </Card>
            )}

            {cashPositions.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-brand-400" />
                  Wallet & Account Balances
                </h2>
                <div className="space-y-2">
                  {cashPositions.map((pos) => {
                    const isForeign = pos.currency !== 'INR';
                    const isSavingsAccount = pos.symbol.includes('SAVINGS-ACCOUNT');
                    const bankBal = isSavingsAccount && summary?.waterfall.openingBalance != null
                      ? (summary.waterfall.openingBalance ?? 0) + summary.waterfall.totalIncome - (summary.waterfall.bankInvestments ?? 0) - (summary.waterfall.walletTransfers ?? 0) - summary.waterfall.cashUpiExpenses
                      : null;
                    const displayValue = bankBal ?? pos.currentValue;
                    const inrValue = isForeign && usdToInr ? displayValue * usdToInr : displayValue;
                    return (
                      <div key={pos.assetId} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                        <span className="text-surface-300 text-sm">{pos.name}</span>
                        <div className="text-right">
                          {isForeign ? (
                            <>
                              <span className="text-surface-100 font-medium tabular-nums">
                                {formatCurrency(inrValue, 'INR')}
                              </span>
                              <span className="text-surface-500 text-xs ml-1.5 tabular-nums">
                                ({formatCurrency(displayValue, pos.currency)})
                              </span>
                            </>
                          ) : (
                            <span className="text-surface-100 font-medium tabular-nums">
                              {formatCurrency(displayValue, 'INR')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 font-semibold">
                    <span className="text-surface-300">Total</span>
                    <span className="text-brand-400 tabular-nums">
                      {formatCurrency(
                        cashPositions.reduce((sum, p) => {
                          const isSav = p.symbol.includes('SAVINGS-ACCOUNT');
                          const bankVal = isSav && summary?.waterfall.openingBalance != null
                            ? (summary.waterfall.openingBalance ?? 0) + summary.waterfall.totalIncome - (summary.waterfall.bankInvestments ?? 0) - (summary.waterfall.walletTransfers ?? 0) - summary.waterfall.cashUpiExpenses
                            : null;
                          const val = bankVal ?? p.currentValue;
                          if (p.currency === 'INR') return sum + val;
                          return sum + (usdToInr ? val * usdToInr : 0);
                        }, 0),
                        'INR',
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Yearly Charts */}
      {yearly && yearly.months.some((m) => m.totals.totalIncome > 0) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Investment per month */}
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Investment per Month</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearly.months.map((m) => ({
                    month: shortMonthLabel(m.month),
                    invested: m.totals.totalInvested,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: number) => [formatCurrency(value, 'INR'), 'Invested']}
                    />
                    <Bar dataKey="invested" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Spend per month: budget vs actual */}
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">Spend per Month</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearly.months.map((m) => ({
                    month: shortMonthLabel(m.month),
                    budget: m.totals.totalBudget,
                    spend: m.totals.totalExpenses,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: number, name: string) => [formatCurrency(value, 'INR'), name === 'budget' ? 'Spend Limit' : 'Spend']}
                    />
                    <Legend formatter={(v) => (v === 'budget' ? 'Spend Limit' : 'Spend')} />
                    <Bar dataKey="budget" fill="#eab308" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spend" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Income & Flow Trend */}
          <Card>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Income, Expenses & Investment Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={yearly.months.map((m) => ({
                  month: shortMonthLabel(m.month),
                  income: m.totals.totalIncome,
                  expenses: m.totals.totalExpenses,
                  investment: m.totals.totalInvested,
                  savings: m.waterfall.savings,
                  expenseLimit: m.income.expenseLimit ?? undefined,
                  investmentTarget: m.income.investmentTarget ?? undefined,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { income: 'Income', expenses: 'Expenses', investment: 'Investment', savings: 'Savings', expenseLimit: 'Expense Limit', investmentTarget: 'Inv. Target' };
                      return [formatCurrency(value, 'INR'), labels[name] ?? name];
                    }}
                  />
                  <Legend formatter={(v) => {
                    const labels: Record<string, string> = { income: 'Income', expenses: 'Expenses', investment: 'Investment', savings: 'Savings', expenseLimit: 'Expense Limit', investmentTarget: 'Inv. Target' };
                    return labels[v] ?? v;
                  }} />
                  <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="investment" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="expenseLimit" stroke="#eab308" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="investmentTarget" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Net Worth Visualization */}
          {projection && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-surface-100">Net Worth Visualization</h2>
                {fireComparison && fireComparison.simulations.length > 0 && (
                  <div className="flex items-center gap-3 text-xs text-surface-500">
                    {fireComparison.simulations.map((fs, idx) => {
                      const fyStartYear = parseInt(fyYear, 10);
                      const row = fs.rows.find((r) => r.year === fyStartYear);
                      return row ? (
                        <span key={fs.id} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FIRE_COLORS[idx % FIRE_COLORS.length] }} />
                          {fs.name}: {formatCurrency(row.corpusStart, 'INR')}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projection.rows.map((r) => {
                    const point: Record<string, any> = {
                      month: shortMonthLabel(r.month),
                      actual: r.actual,
                      base: r.projectedBase,
                      stretch: r.projectedStretch,
                    };
                    // Add FIRE corpus interpolation for each month
                    if (fireComparison) {
                      const [ym, mm] = r.month.split('-').map(Number);
                      for (let i = 0; i < fireComparison.simulations.length; i++) {
                        const fs = fireComparison.simulations[i];
                        const thisYearRow = fs.rows.find((fr) => fr.year === ym);
                        const nextYearRow = fs.rows.find((fr) => fr.year === ym + 1);
                        if (thisYearRow && thisYearRow.corpusStart >= 0) {
                          const yearEnd = thisYearRow.corpusStart + thisYearRow.savings + thisYearRow.returnOnInvestment - thisYearRow.withdrawals;
                          const monthFraction = (mm - 1) / 12;
                          point[`fire_${i}`] = Math.round(
                            thisYearRow.corpusStart + (yearEnd - thisYearRow.corpusStart) * monthFraction,
                          );
                        }
                      }
                    }
                    return point;
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${(v / 100000).toFixed(1)}L`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: any, name: string) => {
                        if (value == null) return ['—', name];
                        if (name === 'actual') return [formatCurrency(value, 'INR'), 'Net Worth'];
                        if (name === 'stretch') return [formatCurrency(value, 'INR'), 'Stretch Target'];
                        if (name === 'base') return [formatCurrency(value, 'INR'), 'Base Target'];
                        if (name.startsWith('fire_') && fireComparison) {
                          const idx = parseInt(name.split('_')[1]);
                          return [formatCurrency(value, 'INR'), fireComparison.simulations[idx]?.name ?? 'FIRE'];
                        }
                        return [formatCurrency(value, 'INR'), name];
                      }}
                    />
                    <Legend
                      formatter={(v) => {
                        if (v === 'actual') return 'Net Worth';
                        if (v === 'stretch') return 'Stretch Target';
                        if (v === 'base') return 'Base Target';
                        if (v.startsWith('fire_') && fireComparison) {
                          return fireComparison.simulations[parseInt(v.split('_')[1])]?.name ?? 'FIRE';
                        }
                        return v;
                      }}
                    />
                    <Area type="monotone" dataKey="stretch" stroke="#22c55e" fill="none" strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="base" stroke="#eab308" fill="none" strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    {fireComparison?.simulations.map((_, idx) => (
                      <Area
                        key={`fire_${idx}`}
                        type="monotone"
                        dataKey={`fire_${idx}`}
                        stroke={FIRE_COLORS[idx % FIRE_COLORS.length]}
                        fill="none"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Target params */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                <div className="p-3 rounded-xl bg-surface-800/50">
                  <p className="text-surface-500">Starting</p>
                  <p className="text-surface-100 font-semibold">{formatCurrency(projection.target.startingValue, 'INR')}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-800/50">
                  <p className="text-surface-500">Monthly Investment</p>
                  <p className="text-surface-100 font-semibold">{formatCurrency(projection.target.monthlyInvestment, 'INR')}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-800/50">
                  <p className="text-surface-500">Return Rate</p>
                  <p className="text-surface-100 font-semibold">{projection.target.yearlyReturnRate}% / year</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-800/50">
                  <p className="text-surface-500">Interest Earned</p>
                  <p className="text-green-400 font-semibold">{formatCurrency(projection.params.interestEarned, 'INR')}</p>
                </div>
              </div>

              {/* Target deficit table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      <th className="text-left py-2 px-3 text-surface-400 font-medium">Month</th>
                      {projection.rows[0]?.projectedStretch != null && (
                        <>
                          <th className="text-right py-2 px-3 text-surface-400 font-medium">Stretch</th>
                          <th className="text-right py-2 px-3 text-surface-400 font-medium">Stretch Deficit</th>
                        </>
                      )}
                      <th className="text-right py-2 px-3 text-surface-400 font-medium">Amount</th>
                      <th className="text-right py-2 px-3 text-surface-400 font-medium">Deficit</th>
                      <th className="text-right py-2 px-3 text-surface-400 font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.rows.map((r) => (
                      <tr key={r.month} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                        <td className="py-2 px-3 text-surface-300">{monthLabel(r.month)}</td>
                        {r.projectedStretch != null && (
                          <>
                            <td className="py-2 px-3 text-right tabular-nums text-surface-100">
                              {formatCurrency(r.projectedStretch, 'INR')}
                            </td>
                            <td className={clsx('py-2 px-3 text-right tabular-nums', (r.deficitStretch ?? 0) > 0 ? 'text-red-400' : 'text-green-400')}>
                              {r.deficitStretch != null ? formatCurrency(r.deficitStretch, 'INR') : '—'}
                            </td>
                          </>
                        )}
                        <td className="py-2 px-3 text-right tabular-nums text-surface-100">
                          {formatCurrency(r.projectedBase, 'INR')}
                        </td>
                        <td className={clsx('py-2 px-3 text-right tabular-nums', (r.deficitBase ?? 0) > 0 ? 'text-red-400' : 'text-green-400')}>
                          {r.deficitBase != null ? formatCurrency(r.deficitBase, 'INR') : '—'}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-surface-300">
                          {r.actual != null ? formatCurrency(r.actual, 'INR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      </div>

      {/* Category Management Modal */}
      <CategoryModal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} categories={categories ?? []} month={selectedMonth} />

      {/* Target/Goal Modal */}
      <TargetModal open={showTargetModal} onClose={() => setShowTargetModal(false)} targets={targets ?? []} />

      {/* Payment Method Modal */}
      <PaymentMethodModal open={showPMModal} onClose={() => setShowPMModal(false)} methods={paymentMethods ?? []} />

      {/* Cycle Settings Modal */}
      <CycleSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentDay={cycleStartDay} />

      {/* Sync to Portfolio Dialog */}
      <Modal isOpen={showSyncDialog} onClose={() => setShowSyncDialog(false)} title="Sync to Portfolio">
        <div className="space-y-4">
          {syncPreview ? (
            syncPreview.primaryBankAssetId == null ? (
              <p className="text-surface-400 text-sm">No primary savings account found. Create a cash asset with "SAVINGS-ACCOUNT" in the symbol.</p>
            ) : syncPreview.cashFlowBalance == null ? (
              <p className="text-surface-400 text-sm">No opening balance set for this month. Set your Current Bank Balance first.</p>
            ) : Math.abs(syncPreview.delta) < 0.01 ? (
              <div className="text-center py-4">
                <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-semibold">Already in sync!</p>
                <p className="text-surface-500 text-xs mt-1">Cash flow and portfolio balances match.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Cash Flow Balance</span>
                    <span className="text-surface-100 font-mono">{formatCurrency(syncPreview.cashFlowBalance, 'INR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Portfolio Ledger Balance</span>
                    <span className="text-surface-100 font-mono">{formatCurrency(syncPreview.ledgerBalance, 'INR')}</span>
                  </div>
                  <div className="flex justify-between border-t border-surface-700 pt-2">
                    <span className="text-surface-300 font-semibold">Difference</span>
                    <span className={clsx('font-mono font-bold', syncPreview.delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {syncPreview.delta >= 0 ? '+' : ''}{formatCurrency(syncPreview.delta, 'INR')}
                    </span>
                  </div>
                </div>
                <p className="text-surface-500 text-xs">
                  This will create a {syncPreview.delta > 0 ? 'deposit' : 'withdrawal'} transaction of {formatCurrency(Math.abs(syncPreview.delta), 'INR')} on your savings account to match the cash flow balance.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSyncDialog(false)} className="btn btn-secondary text-sm">Cancel</button>
                  <button
                    onClick={() => {
                      syncToPortfolio.mutate(selectedMonth, {
                        onSuccess: () => setShowSyncDialog(false),
                      });
                    }}
                    disabled={syncToPortfolio.isPending}
                    className="btn btn-primary text-sm"
                  >
                    {syncToPortfolio.isPending ? 'Syncing...' : 'Confirm Sync'}
                  </button>
                </div>
              </>
            )
          ) : (
            <p className="text-surface-500 text-sm">Loading preview...</p>
          )}
          {(syncPreview?.primaryBankAssetId == null || syncPreview?.cashFlowBalance == null || Math.abs(syncPreview?.delta ?? 0) < 0.01) && (
            <div className="flex justify-end">
              <button onClick={() => setShowSyncDialog(false)} className="btn btn-secondary text-sm">Close</button>
            </div>
          )}
        </div>
      </Modal>

      {/* Pay CC Bill Dialog */}
      <Modal isOpen={showCcPayDialog} onClose={() => setShowCcPayDialog(false)} title="Pay Credit Card Bill">
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">CC Spends for {monthLabel(selectedMonth)}</span>
              <span className="text-red-400 font-mono font-bold">{formatCurrency(summary?.waterfall.ccBillTotal ?? 0, 'INR')}</span>
            </div>
          </div>
          <p className="text-surface-500 text-xs">
            This will create a withdrawal transaction of {formatCurrency(summary?.waterfall.ccBillTotal ?? 0, 'INR')} from your savings account to pay the credit card bill.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCcPayDialog(false)} className="btn btn-secondary text-sm">Cancel</button>
            <button
              onClick={() => {
                payCcBill.mutate({ month: selectedMonth }, {
                  onSuccess: () => setShowCcPayDialog(false),
                });
              }}
              disabled={payCcBill.isPending || (summary?.waterfall.ccBillTotal ?? 0) <= 0}
              className="btn btn-primary text-sm"
            >
              {payCcBill.isPending ? 'Processing...' : 'Pay CC Bill'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Target Progress Bar ──────────────────────────────────────────

// ── Cycle Settings Modal ─────────────────────────────────────────

function CycleSettingsModal({ open, onClose, currentDay }: {
  open: boolean;
  onClose: () => void;
  currentDay: number;
}) {
  const [dayInput, setDayInput] = useState(String(currentDay));
  const updateSettings = useUpdateCashFlowSettings();

  useEffect(() => {
    setDayInput(String(currentDay));
  }, [currentDay]);

  const handleSave = () => {
    const day = parseInt(dayInput, 10);
    if (day >= 1 && day <= 28) {
      updateSettings.mutate({ cycleStartDay: day }, {
        onSuccess: () => onClose(),
      });
    }
  };

  const previewDay = parseInt(dayInput, 10) || 1;
  const salaryDay = previewDay > 1 ? previewDay - 1 : 0;

  return (
    <Modal isOpen={open} onClose={onClose} title="Billing Cycle Settings">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-surface-300 mb-1">Cycle Start Day</label>
          <p className="text-xs text-surface-500 mb-2">
            Day of the month when a new spending cycle begins. Set to 1 for calendar months.
            {salaryDay > 0 && ` Your salary day would be the ${salaryDay}th.`}
          </p>
          <input
            type="number"
            min={1}
            max={28}
            value={dayInput}
            onChange={(e) => setDayInput(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
          />
        </div>

        {previewDay > 1 && (
          <div className="p-3 rounded-xl bg-surface-800/50 text-xs text-surface-400 space-y-1">
            <p><strong className="text-surface-200">Example:</strong> "March" cycle = {previewDay} Feb – {previewDay - 1} Mar</p>
            <p>Salary arrives on the {previewDay - 1}th. Expenses from the {previewDay}th of the previous month through the {previewDay - 1}th count toward this cycle.</p>
          </div>
        )}

        {currentDay !== previewDay && previewDay >= 1 && previewDay <= 28 && (
          <div className="p-3 rounded-xl bg-yellow-500/10 text-xs text-yellow-400">
            Changing the cycle day will re-bucket all existing spends. This is safe and reversible.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending || previewDay === currentDay}
            className="btn btn-primary text-sm"
          >
            {updateSettings.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Expense Table Component ───────────────────────────────────────

function ExpenseTable({
  expenses,
  salary,
  month,
}: {
  expenses: { id: string; categoryId: string; categoryName: string; tag: string | null; budget: number | null; actual: number | null; overspend: number }[];
  salary: number;
  month: string;
}) {
  const updateEntry = useUpdateEntry();
  const createCategory = useCreateCategory();
  const initMonth = useInitMonth();
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'budget' | 'actual' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatTag, setNewCatTag] = useState<ExpenseTag>('need');
  const [newCatBudget, setNewCatBudget] = useState('');

  const totalBudget = expenses.reduce((s, e) => s + (e.budget ?? 0), 0);
  const totalActual = expenses.reduce((s, e) => s + (e.actual ?? 0), 0);
  const totalOverspend = totalActual - totalBudget;

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    createCategory.mutate(
      { name: newCatName.trim(), type: 'expense', tag: newCatTag, defaultBudget: parseFloat(newCatBudget) || 0 },
      { onSuccess: () => {
        initMonth.mutate(month);
        setNewCatName('');
        setNewCatBudget('');
        setShowAddRow(false);
      }},
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700">
            <th className="text-left py-2 px-3 text-surface-400 font-medium">Category</th>
            <th className="text-right py-2 px-3 text-surface-400 font-medium">Spend Limit</th>
            <th className="text-right py-2 px-3 text-surface-400 font-medium">Spend</th>
            <th className="text-right py-2 px-3 text-surface-400 font-medium">Overspend</th>
            <th className="text-center py-2 px-3 text-surface-400 font-medium">Tag</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((row) => (
            <tr key={row.id} className="border-b border-surface-800/50 hover:bg-surface-800/30">
              <td className="py-2 px-3 text-surface-300">{row.categoryName}</td>
              <td className="py-2 px-3 text-right tabular-nums">
                {editingCell?.id === row.id && editingCell.field === 'budget' ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      updateEntry.mutate({ id: row.id, budget: parseFloat(editValue) || 0 });
                      setEditingCell(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingCell(null);
                    }}
                    className="w-24 px-2 py-0.5 rounded bg-surface-800 border border-brand-500 text-surface-100 text-right text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => { setEditingCell({ id: row.id, field: 'budget' }); setEditValue(String(row.budget ?? 0)); }}
                    className="text-surface-100 hover:text-brand-400 transition-colors"
                  >
                    {formatCurrency(row.budget ?? 0, 'INR')}
                  </button>
                )}
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                {editingCell?.id === row.id && editingCell.field === 'actual' ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      updateEntry.mutate({ id: row.id, actual: parseFloat(editValue) || 0 });
                      setEditingCell(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingCell(null);
                    }}
                    className="w-24 px-2 py-0.5 rounded bg-surface-800 border border-brand-500 text-surface-100 text-right text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => { setEditingCell({ id: row.id, field: 'actual' }); setEditValue(String(row.actual ?? 0)); }}
                    className={clsx('hover:text-brand-400 transition-colors', (row.actual ?? 0) > (row.budget ?? 0) ? 'text-red-400' : 'text-surface-100')}
                  >
                    {formatCurrency(row.actual ?? 0, 'INR')}
                  </button>
                )}
              </td>
              <td className={clsx('py-2 px-3 text-right tabular-nums font-medium', row.overspend > 0 ? 'text-red-400' : row.overspend < 0 ? 'text-green-400' : 'text-surface-500')}>
                {row.overspend !== 0 ? formatCurrency(row.overspend, 'INR') : '0'}
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className={clsx(
                    'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                    row.tag === 'need' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400',
                  )}
                >
                  {row.tag === 'need' ? 'Need' : 'Luxury'}
                </span>
              </td>
            </tr>
          ))}

          {/* Inline add category row */}
          {showAddRow ? (
            <tr className="border-b border-surface-800/50 bg-surface-800/20">
              <td className="py-2 px-3">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowAddRow(false); }}
                  className="w-full px-2 py-1 rounded bg-surface-800 border border-surface-600 text-surface-100 text-sm focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </td>
              <td className="py-2 px-3 text-right">
                <input
                  type="number"
                  value={newCatBudget}
                  onChange={(e) => setNewCatBudget(e.target.value)}
                  placeholder="Budget"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  className="w-24 px-2 py-1 rounded bg-surface-800 border border-surface-600 text-surface-100 text-right text-sm focus:outline-none focus:border-brand-500"
                />
              </td>
              <td className="py-2 px-3" />
              <td className="py-2 px-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={handleAddCategory} disabled={createCategory.isPending} className="btn btn-primary text-xs px-2 py-0.5">Add</button>
                  <button onClick={() => setShowAddRow(false)} className="text-surface-500 hover:text-surface-300 px-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              </td>
              <td className="py-2 px-3 text-center">
                <select
                  value={newCatTag}
                  onChange={(e) => setNewCatTag(e.target.value as ExpenseTag)}
                  className="px-2 py-1 rounded bg-surface-800 border border-surface-600 text-surface-100 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="need">Need</option>
                  <option value="luxury">Luxury</option>
                </select>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={5} className="py-2 px-3">
                <button
                  onClick={() => setShowAddRow(true)}
                  className="flex items-center gap-1 text-xs text-surface-500 hover:text-brand-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add category
                </button>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-surface-700 font-semibold">
            <td className="py-2 px-3 text-surface-100">Total</td>
            <td className="py-2 px-3 text-right tabular-nums text-surface-100">{formatCurrency(totalBudget, 'INR')}</td>
            <td className="py-2 px-3 text-right tabular-nums text-surface-100">{formatCurrency(totalActual, 'INR')}</td>
            <td className={clsx('py-2 px-3 text-right tabular-nums', totalOverspend > 0 ? 'text-red-400' : 'text-green-400')}>
              {formatCurrency(totalOverspend, 'INR')}
            </td>
            <td />
          </tr>
          {salary > 0 && (
            <tr className="text-surface-500">
              <td className="py-1 px-3">% Salary</td>
              <td className="py-1 px-3 text-right tabular-nums">{((totalBudget / salary) * 100).toFixed(1)}%</td>
              <td className="py-1 px-3 text-right tabular-nums">{((totalActual / salary) * 100).toFixed(1)}%</td>
              <td />
              <td />
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

// ── Add Spend Form ───────────────────────────────────────────────

const DISCOUNT_PATTERN = /discount|waiver|cashback|refund/i;

function AddSpendForm({ categories, paymentMethods, month }: {
  categories: CashFlowCategory[];
  paymentMethods: PaymentMethod[];
  month: string;
}) {
  const addSpend = useAddSpend();
  const today = todayLocal();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pmId, setPmId] = useState('');
  const [description, setDescription] = useState('');
  const [spendDate, setSpendDate] = useState(today);
  const [spendType, setSpendType] = useState<'expense' | 'income'>('expense');

  const filteredCats = categories.filter((c) => c.type === spendType);
  const selectedCat = categories.find((c) => c.id === categoryId);
  const isDiscount = selectedCat ? DISCOUNT_PATTERN.test(selectedCat.name) : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !pmId) return;
    const parsedAmount = parseFloat(amount);
    const finalAmount = isDiscount ? -Math.abs(parsedAmount) : parsedAmount;
    addSpend.mutate(
      { categoryId, paymentMethodId: pmId, amount: finalAmount, description: description || undefined, spendDate, type: spendType },
      { onSuccess: () => { setAmount(''); setDescription(''); } },
    );
  };

  return (
    <Card padding="sm">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          <button type="button" onClick={() => { setSpendType('expense'); setCategoryId(''); }}
            className={clsx('text-xs px-2.5 py-1 rounded-md transition-colors', spendType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-surface-400 hover:text-surface-200')}>
            Expense
          </button>
          <button type="button" onClick={() => { setSpendType('income'); setCategoryId(''); }}
            className={clsx('text-xs px-2.5 py-1 rounded-md transition-colors', spendType === 'income' ? 'bg-green-500/20 text-green-400' : 'text-surface-400 hover:text-surface-200')}>
            Income
          </button>
        </div>
        <div>
          <label className="block text-[10px] text-surface-500 mb-0.5">
            {isDiscount ? 'Discount Amount' : 'Amount'}
          </label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
            className={clsx('w-28 px-2.5 py-1.5 rounded-lg text-sm bg-surface-800 border text-surface-100 focus:outline-none tabular-nums',
              isDiscount ? 'border-green-500/50 focus:border-green-500' : 'border-surface-700 focus:border-brand-500')} required />
          {isDiscount && amount && (
            <p className="text-[10px] text-green-400 mt-0.5">Reduces expenses by ₹{Math.abs(parseFloat(amount) || 0)}</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] text-surface-500 mb-0.5">Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="w-36 px-2.5 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" required>
            <option value="">Select...</option>
            {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-surface-500 mb-0.5">Payment Method</label>
          <select value={pmId} onChange={(e) => setPmId(e.target.value)}
            className="w-40 px-2.5 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" required>
            <option value="">Select...</option>
            {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-surface-500 mb-0.5">Date</label>
          <input type="date" value={spendDate} onChange={(e) => setSpendDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] text-surface-500 mb-0.5">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional"
            className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
        </div>
        <button type="submit" disabled={addSpend.isPending} className="btn btn-primary text-sm py-1.5">
          <Plus className="w-4 h-4" /> {addSpend.isPending ? 'Adding...' : 'Add'}
        </button>
      </form>
    </Card>
  );
}

// ── Spend Log ────────────────────────────────────────────────────

function SpendLog({ spends: rawSpends, categories, paymentMethods, filterPmId }: {
  spends: CashFlowSpend[];
  categories: CashFlowCategory[];
  paymentMethods: PaymentMethod[];
  filterPmId: string | null;
}) {
  const spends = useMemo(
    () => {
      const sorted = [...rawSpends].sort((a, b) => b.spendDate.localeCompare(a.spendDate));
      return filterPmId ? sorted.filter((s) => s.paymentMethodId === filterPmId) : sorted;
    },
    [rawSpends, filterPmId],
  );
  const deleteSpend = useDeleteSpend();
  const updateSpend = useUpdateSpend();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [editPmId, setEditPmId] = useState('');
  const [editDate, setEditDate] = useState('');

  const startEdit = (s: CashFlowSpend) => {
    setEditingId(s.id);
    setEditAmount(String(Math.abs(s.amount)));
    setEditDesc(s.description || '');
    setEditCatId(s.categoryId);
    setEditPmId(s.paymentMethodId);
    setEditDate(s.spendDate);
  };

  const saveEdit = (s: CashFlowSpend) => {
    const cat = categories.find((c) => c.id === editCatId);
    const isDiscount = cat ? DISCOUNT_PATTERN.test(cat.name) : false;
    const parsed = parseFloat(editAmount);
    if (isNaN(parsed)) return;
    const finalAmount = isDiscount ? -Math.abs(parsed) : (s.amount < 0 && !isDiscount ? -Math.abs(parsed) : parsed);
    updateSpend.mutate(
      { id: s.id, amount: finalAmount, description: editDesc || undefined, categoryId: editCatId, paymentMethodId: editPmId, spendDate: editDate },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const cancelEdit = () => setEditingId(null);

  const inputClass = 'px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 text-surface-100 text-xs focus:outline-none focus:border-brand-500';

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-surface-100">Spend Log</h2>
        {filterPmId && (
          <span className="text-xs bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-full">
            {paymentMethods.find((pm) => pm.id === filterPmId)?.name ?? 'Filtered'}
          </span>
        )}
        <span className="text-xs text-surface-500 ml-auto tabular-nums">{spends.length} entries</span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-900 z-10">
            <tr className="border-b border-surface-800">
              <th className="py-1.5 px-2 text-left text-surface-500 font-medium">Date</th>
              <th className="py-1.5 px-2 text-left text-surface-500 font-medium">Description</th>
              <th className="py-1.5 px-2 text-left text-surface-500 font-medium">Category</th>
              <th className="py-1.5 px-2 text-left text-surface-500 font-medium">Paid Via</th>
              <th className="py-1.5 px-2 text-right text-surface-500 font-medium">Amount</th>
              <th className="py-1.5 px-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {spends.map((s) => {
              const isEditing = editingId === s.id;
              const filteredCats = categories.filter((c) => c.type === s.type);

              if (isEditing) {
                return (
                  <tr key={s.id} className="border-b border-brand-500/30 bg-brand-500/5">
                    <td className="py-1.5 px-2">
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                        className={clsx(inputClass, 'w-[120px]')} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description" className={clsx(inputClass, 'w-full')} />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={editCatId} onChange={(e) => setEditCatId(e.target.value)} className={clsx(inputClass, 'w-full')}>
                        {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={editPmId} onChange={(e) => setEditPmId(e.target.value)} className={clsx(inputClass, 'w-full')}>
                        {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                        className={clsx(inputClass, 'w-20 text-right tabular-nums')} />
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => saveEdit(s)} disabled={updateSpend.isPending}
                          className="text-green-400 hover:text-green-300 transition-colors p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="text-surface-500 hover:text-surface-300 transition-colors p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={s.id} className="border-b border-surface-800/40 hover:bg-surface-800/20 group">
                  <td className="py-1.5 px-2 text-surface-400 whitespace-nowrap">{new Date(s.spendDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="py-1.5 px-2 text-surface-300 truncate max-w-[160px]">{s.description || '—'}</td>
                  <td className="py-1.5 px-2 text-surface-300">{s.categoryName}</td>
                  <td className="py-1.5 px-2 text-surface-400">{s.paymentMethodName}</td>
                  <td className={clsx('py-1.5 px-2 text-right tabular-nums font-medium',
                    s.type === 'income' ? 'text-green-400' : s.amount < 0 ? 'text-green-400' : 'text-surface-100')}>
                    {s.type === 'income' ? '+' : ''}{s.amount < 0 ? '−' : ''}{formatCurrency(Math.abs(s.amount), 'INR')}
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(s)} className="text-surface-600 hover:text-brand-400 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => deleteSpend.mutate(s.id)} className="text-surface-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Payment Method Breakdown ─────────────────────────────────────

function PaymentBreakdown({ breakdown, selectedId, onSelect }: {
  breakdown: PaymentMethodBreakdownRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const total = breakdown.reduce((s, b) => s + b.total, 0);

  const handlePieClick = (_: unknown, idx: number) => {
    const clicked = breakdown[idx];
    if (!clicked) return;
    onSelect(clicked.id === selectedId ? null : clicked.id);
  };

  return (
    <Card>
      <h2 className="text-sm font-semibold text-surface-100 mb-3">By Payment Method</h2>
      {breakdown.length > 0 ? (
        <>
          <div className="h-40 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  onClick={handlePieClick}
                  cursor="pointer"
                >
                  {breakdown.map((b, idx) => (
                    <Cell
                      key={idx}
                      fill={PM_COLORS[idx % PM_COLORS.length]}
                      opacity={selectedId && selectedId !== b.id ? 0.3 : 1}
                      stroke={selectedId === b.id ? '#fff' : 'transparent'}
                      strokeWidth={selectedId === b.id ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                  formatter={(v: number) => [formatCurrency(v, 'INR')]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {breakdown.map((b, idx) => (
              <div
                key={b.id}
                onClick={() => onSelect(b.id === selectedId ? null : b.id)}
                className={clsx(
                  'flex items-center justify-between text-xs px-2 py-1 rounded cursor-pointer transition-all',
                  selectedId === b.id ? 'bg-surface-800 ring-1 ring-brand-500/50' : 'hover:bg-surface-800/40',
                  selectedId && selectedId !== b.id && 'opacity-40',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PM_COLORS[idx % PM_COLORS.length] }} />
                  <span className="text-surface-300">{b.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-surface-100 tabular-nums font-medium">{formatCurrency(b.total, 'INR')}</span>
                  <span className="text-surface-500 tabular-nums w-10 text-right">{total > 0 ? `${((b.total / total) * 100).toFixed(0)}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          {selectedId && (
            <button
              onClick={() => onSelect(null)}
              className="mt-2 w-full text-xs text-surface-500 hover:text-surface-300 transition-colors py-1"
            >
              Clear filter
            </button>
          )}
        </>
      ) : (
        <p className="text-surface-500 text-xs text-center py-8">No spends logged yet</p>
      )}
    </Card>
  );
}

// ── Payment Method Modal ─────────────────────────────────────────

const PM_TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
};

function PaymentMethodModal({ open, onClose, methods }: {
  open: boolean; onClose: () => void; methods: PaymentMethod[];
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentMethodType>('credit_card');

  const createPM = useCreatePaymentMethod();
  const deletePM = useDeletePaymentMethod();

  const handleCreate = () => {
    if (!name.trim()) return;
    createPM.mutate({ name: name.trim(), type });
    setName('');
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Payment Methods">
      <div className="space-y-4">
        <div className="max-h-60 overflow-y-auto space-y-1">
          {methods.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-800/50">
              <div className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-surface-700 text-surface-300">
                  {PM_TYPE_LABELS[pm.type as PaymentMethodType] ?? pm.type}
                </span>
                <span className="text-surface-200 text-sm">{pm.name}</span>
              </div>
              <button onClick={() => deletePM.mutate(pm.id)} className="text-surface-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {methods.length === 0 && (
            <p className="text-surface-500 text-sm text-center py-4">No payment methods yet</p>
          )}
        </div>

        <div className="border-t border-surface-700 pt-4 space-y-3">
          <div className="flex gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kotak Credit Card"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <select value={type} onChange={(e) => setType(e.target.value as PaymentMethodType)}
              className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500">
              {Object.entries(PM_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button onClick={handleCreate} className="btn btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Category Management Modal ─────────────────────────────────────

function CategoryModal({
  open,
  onClose,
  categories,
  month,
}: {
  open: boolean;
  onClose: () => void;
  categories: CashFlowCategory[];
  month: string;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [tag, setTag] = useState<ExpenseTag>('need');
  const [budget, setBudget] = useState('');

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const initMonth = useInitMonth();

  const handleCreate = () => {
    if (!name.trim()) return;
    createCategory.mutate(
      {
        name: name.trim(),
        type,
        tag: type === 'expense' ? tag : undefined,
        defaultBudget: parseFloat(budget) || 0,
      },
      { onSuccess: () => initMonth.mutate(month) },
    );
    setName('');
    setBudget('');
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Manage Categories">
      <div className="space-y-4">
        {/* Existing categories */}
        <div className="max-h-60 overflow-y-auto space-y-1">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-800/50">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                  cat.type === 'income' ? 'bg-green-500/20 text-green-400' :
                  cat.tag === 'need' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400',
                )}>
                  {cat.type === 'income' ? 'Income' : cat.tag === 'need' ? 'Need' : 'Luxury'}
                </span>
                <span className="text-surface-200 text-sm">{cat.name}</span>
                {cat.defaultBudget ? (
                  <span className="text-surface-500 text-xs">({formatCurrency(cat.defaultBudget, 'INR')})</span>
                ) : null}
              </div>
              <button
                onClick={() => deleteCategory.mutate(cat.id)}
                className="text-surface-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-surface-500 text-sm text-center py-4">No categories yet</p>
          )}
        </div>

        {/* Add new */}
        <div className="border-t border-surface-700 pt-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
            />
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Budget"
              className="w-28 px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense')}
              className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            {type === 'expense' && (
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as ExpenseTag)}
                className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
              >
                <option value="need">Need</option>
                <option value="luxury">Luxury</option>
              </select>
            )}
            <button onClick={handleCreate} className="btn btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Target/Goal Modal ─────────────────────────────────────────────

function TargetModal({
  open,
  onClose,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  targets: NetWorthTarget[];
}) {
  const [name, setName] = useState('');
  const [startingValue, setStartingValue] = useState('');
  const [monthlyInvestment, setMonthlyInvestment] = useState('');
  const [stretchMonthly, setStretchMonthly] = useState('');
  const [returnRate, setReturnRate] = useState('12.5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const createTarget = useCreateTarget();
  const deleteTarget = useDeleteTarget();

  const handleCreate = () => {
    if (!name.trim() || !startingValue || !monthlyInvestment || !startDate || !endDate) return;
    createTarget.mutate({
      name: name.trim(),
      startingValue: parseFloat(startingValue),
      monthlyInvestment: parseFloat(monthlyInvestment),
      yearlyReturnRate: parseFloat(returnRate) || 12.5,
      stretchMonthlyInvestment: stretchMonthly ? parseFloat(stretchMonthly) : undefined,
      startDate,
      endDate,
    });
    setName('');
    setStartingValue('');
    setMonthlyInvestment('');
    setStretchMonthly('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Net Worth Goals">
      <div className="space-y-4">
        {/* Existing targets */}
        <div className="space-y-2">
          {targets.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-800/50">
              <div>
                <p className="text-surface-200 text-sm font-medium">{t.name}</p>
                <p className="text-surface-500 text-xs">
                  {formatCurrency(t.startingValue, 'INR')} → {formatCurrency(t.monthlyInvestment, 'INR')}/mo @ {t.yearlyReturnRate}%
                  {' · '}{t.startDate} to {t.endDate}
                </p>
              </div>
              <button onClick={() => deleteTarget.mutate(t.id)} className="text-surface-600 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {targets.length === 0 && (
            <p className="text-surface-500 text-sm text-center py-4">No goals set</p>
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-surface-700 pt-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goal name (e.g., FY 2026-27)"
            className="w-full px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={startingValue} onChange={(e) => setStartingValue(e.target.value)} placeholder="Starting value" className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <input type="number" value={returnRate} onChange={(e) => setReturnRate(e.target.value)} placeholder="Return % / year" className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <input type="number" value={monthlyInvestment} onChange={(e) => setMonthlyInvestment(e.target.value)} placeholder="Monthly investment" className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <input type="number" value={stretchMonthly} onChange={(e) => setStretchMonthly(e.target.value)} placeholder="Stretch monthly (optional)" className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
            <input type="month" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-lg text-sm bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500" />
          </div>
          <button onClick={handleCreate} className="btn btn-primary text-sm w-full">
            <Plus className="w-4 h-4" /> Create Goal
          </button>
        </div>
      </div>
    </Modal>
  );
}
