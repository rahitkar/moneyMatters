import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  Flame,
  Save,
  Trash2,
  Plus,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Wallet,
  AlertTriangle,
  Target,
  Settings2,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
} from 'recharts';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { formatCurrency, todayLocal } from '../lib/format';
import {
  useFireSimulations,
  useFireCompare,
  useFireAutoSeed,
  useFireSyncPortfolio,
  useFirePreview,
  useCreateFireSimulation,
  useUpdateFireSimulation,
  useDeleteFireSimulation,
  usePortfolioSummary,
  useFireMonthlyTargets,
  useCashFlowSettings,
  useUpdateCashFlowSettings,
  useExchangeRate,
} from '../api/hooks';
import type { FireSimulationInput, FireSimulationResult, FireSimulationRow, FireComparisonData, FireMonthlyTargetData } from '../api/types';

const SCENARIO_COLORS: Record<number, string> = {
  0: '#22c55e',
  1: '#eab308',
  2: '#3b82f6',
  3: '#a855f7',
  4: '#f97316',
};
const ACTUAL_COLOR = '#ef4444';
const scenarioColor = (i: number) => SCENARIO_COLORS[i] ?? SCENARIO_COLORS[i % 5];

function fmtLakh(v: number): string {
  if (Math.abs(v) >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
  if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)} L`;
  return formatCurrency(v, 'INR');
}
function pctDisplay(v: number) { return `${(v * 100).toFixed(1)}%`; }
function getCorpusAtRetirement(rows: FireSimulationRow[]) {
  const r = rows.find((r) => r.status === 'retired_here');
  return r ? r.corpusStart + r.savings + r.returnOnInvestment - r.withdrawals : 0;
}
function getFundsLastAge(rows: FireSimulationRow[], le: number) {
  const last = [...rows].reverse().find((r) => r.corpusStart > 0 && (r.status === 'retired' || r.status === 'dead'));
  return last ? last.age : le;
}
const yFmt = (v: number) => {
  if (Math.abs(v) >= 10000000) return `${(v / 10000000).toFixed(v % 10000000 === 0 ? 0 : 1)}Cr`;
  if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(0)}L`;
  return `${(v / 1000).toFixed(0)}K`;
};
const tooltipStyle = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' };

function fmtUsd(inr: number, rate: number | null): string {
  if (!rate) return '';
  const usd = inr / rate;
  if (Math.abs(usd) >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
  if (Math.abs(usd) >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

// ── Page ──────────────────────────────────────────────────────────

function computeAge(dob: string): { years: number; months: number } {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = todayLocal().split('-').map(Number);
  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months--;
  if (months < 0) { years--; months += 12; }
  return { years, months };
}

export default function FireSimulator() {
  const { data: savedSims } = useFireSimulations();
  const { data: comparison } = useFireCompare();
  const { data: portfolio } = usePortfolioSummary();
  const { data: monthlyTargets } = useFireMonthlyTargets();
  const { data: cfSettings } = useCashFlowSettings();
  const updateSettings = useUpdateCashFlowSettings();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = portfolio?.usdToInr ?? usdInrRate?.rate ?? null;

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [inputs, setInputs] = useState<FireSimulationInput | null>(null);
  const [previewResult, setPreviewResult] = useState<FireSimulationResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDob, setEditingDob] = useState(false);
  const [dobInput, setDobInput] = useState('');

  const dob = cfSettings?.dob ?? null;
  const age = dob ? computeAge(dob) : null;

  const preview = useFirePreview();
  const createSim = useCreateFireSimulation();
  const updateSim = useUpdateFireSimulation();
  const deleteSim = useDeleteFireSimulation();
  const autoSeed = useFireAutoSeed();
  const syncPortfolio = useFireSyncPortfolio();

  useEffect(() => {
    if (savedSims && savedSims.length > 0 && !activeTab && !isCreating) {
      setActiveTab(savedSims[0].id);
    }
  }, [savedSims, activeTab, isCreating]);

  useEffect(() => {
    if (!activeTab || !comparison) return;
    const sim = comparison.simulations.find((s) => s.id === activeTab);
    if (sim) {
      const s = sim.simulation;
      setInputs({
        name: s.name, currentAge: s.currentAge, retirementAge: s.retirementAge,
        lifeExpectancy: s.lifeExpectancy, currentSavings: s.currentSavings,
        monthlySaving: s.monthlySaving, annualSavingsIncrease: s.annualSavingsIncrease,
        returnOnInvestment: s.returnOnInvestment, capitalGainTax: s.capitalGainTax,
        postRetirementMonthlyExpense: s.postRetirementMonthlyExpense,
        inflationRate: s.inflationRate, startYear: s.startYear,
      });
      setPreviewResult(sim);
    }
  }, [activeTab, comparison]);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const runPreview = useCallback(
    (inp: FireSimulationInput) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        preview.mutate(inp, { onSuccess: (r) => setPreviewResult(r) });
      }, 400);
    },
    [preview],
  );

  const updateInput = <K extends keyof FireSimulationInput>(key: K, value: FireSimulationInput[K]) => {
    if (!inputs) return;
    const next = { ...inputs, [key]: value };
    setInputs(next);
    runPreview(next);
  };

  const handleSave = () => {
    if (!inputs) return;
    if (isCreating) {
      createSim.mutate(inputs, {
        onSuccess: (resp) => { setActiveTab(resp.simulation.id); setIsCreating(false); setShowEditor(false); },
      });
    } else if (activeTab) {
      updateSim.mutate({ id: activeTab, ...inputs });
    }
  };

  const handleDelete = () => {
    if (!activeTab) return;
    deleteSim.mutate(activeTab, {
      onSuccess: () => { setActiveTab(null); setInputs(null); setPreviewResult(null); setShowEditor(false); },
    });
  };

  const handleNewScenario = () => {
    setIsCreating(true);
    setActiveTab(null);
    setShowEditor(true);
    setInputs({
      name: `FIRE Scenario ${(savedSims?.length ?? 0) + 1}`,
      currentAge: 27, retirementAge: 40, lifeExpectancy: 85,
      currentSavings: portfolio?.totalValue ?? 3076000, monthlySaving: 117500,
      annualSavingsIncrease: 0.22, returnOnInvestment: 0.125, capitalGainTax: 0.125,
      postRetirementMonthlyExpense: 100000, inflationRate: 0.09,
      startYear: Number(todayLocal().split('-')[0]),
    });
    setPreviewResult(null);
  };

  const overlayData = useMemo(() => {
    if (!comparison || comparison.simulations.length === 0) return null;
    let minYear = Infinity, maxYear = -Infinity;
    for (const sim of comparison.simulations)
      for (const row of sim.rows)
        if (row.corpusStart >= 0) { minYear = Math.min(minYear, row.year); maxYear = Math.max(maxYear, row.year); }
    for (const p of comparison.actualPortfolio) { minYear = Math.min(minYear, p.year); maxYear = Math.max(maxYear, p.year); }
    if (!isFinite(minYear)) return null;
    const actualMap = new Map(comparison.actualPortfolio.map((p) => [p.year, p.value]));
    const refSim = comparison.simulations[0];
    const refAgeOffset = refSim.simulation.currentAge - refSim.simulation.startYear;
    const data: Record<string, any>[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const point: Record<string, any> = { year: y, age: y + refAgeOffset };
      for (let i = 0; i < comparison.simulations.length; i++) {
        const row = comparison.simulations[i].rows.find((r) => r.year === y);
        point[`sim_${i}`] = row && row.corpusStart >= 0 ? row.corpusStart : null;
      }
      point.actual = actualMap.get(y) ?? null;
      data.push(point);
    }
    return data;
  }, [comparison]);

  const selectedResult = previewResult;
  const selectedRows = selectedResult?.rows ?? [];
  const hasSims = savedSims && savedSims.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-400" /> FIRE Simulator
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-surface-500 text-sm">Track your path to financial independence</p>
            {editingDob ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dobInput}
                  onChange={(e) => setDobInput(e.target.value)}
                  className="px-2 py-0.5 rounded bg-surface-800 border border-surface-700 text-surface-100 text-xs focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => {
                    if (dobInput) updateSettings.mutate({ dob: dobInput });
                    setEditingDob(false);
                  }}
                  className="text-green-400 hover:text-green-300 text-xs px-1.5 py-0.5 rounded bg-surface-800"
                >Save</button>
                <button onClick={() => setEditingDob(false)} className="text-surface-500 hover:text-surface-300 text-xs px-1.5 py-0.5">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setDobInput(dob ?? ''); setEditingDob(true); }}
                className="inline-flex items-center gap-1.5 text-xs bg-surface-800 hover:bg-surface-700 text-surface-300 px-2.5 py-1 rounded-full transition-colors"
              >
                <Calendar className="w-3 h-3 text-surface-500" />
                {age ? (
                  <span>Age <span className="text-surface-100 font-semibold">{age.years}y {age.months}m</span></span>
                ) : (
                  <span className="text-surface-500">Set DOB</span>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSims && (
            <>
              <button onClick={() => syncPortfolio.mutate(undefined)} disabled={syncPortfolio.isPending}
                className="btn btn-secondary text-sm" title="Update Base/Lean/Fat with current portfolio value">
                <RefreshCw className={clsx('w-4 h-4', syncPortfolio.isPending && 'animate-spin')} />
                {syncPortfolio.isPending ? 'Syncing...' : 'Sync Portfolio'}
              </button>
              <button onClick={() => autoSeed.mutate(undefined)} disabled={autoSeed.isPending}
                className="btn btn-secondary text-sm" title="Reset all scenarios to Excel reference values">
                <Flame className="w-4 h-4" /> Reset
              </button>
            </>
          )}
          <button onClick={handleNewScenario} className="btn btn-primary text-sm">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {/* ── Scrollable Content ──────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">

        {/* Empty state */}
        {!hasSims && !isCreating && (
          <Card>
            <div className="text-center py-16">
              <Flame className="w-14 h-14 text-orange-400 mx-auto mb-4 opacity-80" />
              <h3 className="text-xl font-semibold text-surface-200 mb-2">Plan Your FIRE</h3>
              <p className="text-surface-400 text-sm max-w-md mx-auto mb-8">
                Auto-generate Base, Lean, and Fat FIRE scenarios matching your Excel, or create custom ones.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => autoSeed.mutate(undefined)} disabled={autoSeed.isPending} className="btn btn-primary">
                  <Flame className="w-4 h-4" /> {autoSeed.isPending ? 'Generating...' : 'Auto-Generate from Excel'}
                </button>
                <button onClick={handleNewScenario} className="btn btn-secondary">
                  <Plus className="w-4 h-4" /> Custom Scenario
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ── Scenario Cards (merged: summary + edit) ─────────── */}
        {hasSims && comparison && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {comparison.simulations.map((sim, idx) => (
              <ScenarioCard key={sim.id} sim={sim} idx={idx}
                isActive={activeTab === sim.id && !isCreating}
                usdToInr={usdToInr}
                onSelect={() => { setIsCreating(false); setActiveTab(sim.id); }}
                onSave={(updates) => updateSim.mutate({ id: sim.id, ...updates })}
                onDelete={() => deleteSim.mutate(sim.id, { onSuccess: () => { setActiveTab(null); setInputs(null); setPreviewResult(null); } })}
              />
            ))}
          </div>
        )}

        {/* ── Monthly Progress ────────────────────────────────── */}
        {monthlyTargets && monthlyTargets.scenarios.length > 0 && (
          <MonthlyProgress data={monthlyTargets} usdToInr={usdToInr} />
        )}

        {/* ── Overlay Chart ──────────────────────────────────── */}
        {overlayData && comparison && comparison.simulations.length > 0 && (
          <Card>
            <h2 className="text-base font-semibold text-surface-100 mb-4">Scenarios vs Actual Portfolio</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="age" stroke="#52525b" fontSize={11} interval={4}
                    label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fill: '#52525b', fontSize: 10 }} />
                  <YAxis stroke="#52525b" fontSize={11} tickFormatter={yFmt} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa' }}
                    formatter={(v: any, name: string) => {
                      if (v == null) return ['—', name];
                      const label = name === 'actual' ? 'Portfolio' : comparison.simulations[parseInt(name.split('_')[1])]?.name ?? name;
                      const usd = usdToInr ? ` (${fmtUsd(v, usdToInr)})` : '';
                      return [`${formatCurrency(v, 'INR')}${usd}`, label];
                    }}
                    labelFormatter={(_: any, p: any) => { const d = p?.[0]?.payload; return d ? `Age ${d.age} (${d.year})` : ''; }}
                  />
                  <Legend formatter={(v) => v === 'actual' ? 'Actual Portfolio' : comparison.simulations[parseInt(v.split('_')[1])]?.name ?? v} />
                  {comparison.simulations.map((sim, idx) => {
                    const rAge = sim.simulation.retirementAge;
                    return <ReferenceLine key={`fire-${sim.id}`} x={rAge} stroke={scenarioColor(idx)} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `${sim.name} (${rAge})`, position: 'insideTopRight', fill: scenarioColor(idx), fontSize: 9 }} />;
                  })}
                  {comparison.simulations.map((sim, idx) => (
                    <Line key={sim.id} type="monotone" dataKey={`sim_${idx}`} stroke={scenarioColor(idx)} strokeWidth={2} dot={false} connectNulls />
                  ))}
                  <Line type="monotone" dataKey="actual" stroke={ACTUAL_COLOR} strokeWidth={3} dot={{ r: 3, fill: ACTUAL_COLOR }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* (Scenario Cards moved to top) */}

        {/* ── New Scenario Editor ────────────────────────────── */}
        {isCreating && inputs && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-surface-100">New Scenario</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleSave} disabled={createSim.isPending} className="btn btn-primary text-xs px-3 py-1">
                  <Save className="w-3 h-3" /> Create
                </button>
                <button onClick={() => { setIsCreating(false); if (savedSims?.length) setActiveTab(savedSims[0].id); }} className="btn btn-secondary text-xs px-2 py-1">Cancel</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <InputField label="Scenario Name" value={inputs.name} onChange={(v) => updateInput('name', v)} type="text" />
              <InputField label="Current Age" value={inputs.currentAge} onChange={(v) => updateInput('currentAge', parseInt(v) || 0)} suffix="yrs" />
              <InputField label="Retire At" value={inputs.retirementAge} onChange={(v) => updateInput('retirementAge', parseInt(v) || 0)} suffix="yrs" />
              <InputField label="Life Expectancy" value={inputs.lifeExpectancy} onChange={(v) => updateInput('lifeExpectancy', parseInt(v) || 0)} suffix="yrs" />
              <InputField label="Current Savings" value={inputs.currentSavings} onChange={(v) => updateInput('currentSavings', parseFloat(v) || 0)} prefix="₹" />
              <InputField label="Monthly Saving" value={inputs.monthlySaving} onChange={(v) => updateInput('monthlySaving', parseFloat(v) || 0)} prefix="₹" />
              <InputField label="Savings Increase" value={(inputs.annualSavingsIncrease * 100).toFixed(1)} onChange={(v) => updateInput('annualSavingsIncrease', (parseFloat(v) || 0) / 100)} suffix="% /yr" />
              <InputField label="ROI (Pre-Tax)" value={(inputs.returnOnInvestment * 100).toFixed(1)} onChange={(v) => updateInput('returnOnInvestment', (parseFloat(v) || 0) / 100)} suffix="%" />
              <InputField label="Capital Gain Tax" value={(inputs.capitalGainTax * 100).toFixed(1)} onChange={(v) => updateInput('capitalGainTax', (parseFloat(v) || 0) / 100)} suffix="%" />
              <InputField label="Post-Retirement Exp" value={inputs.postRetirementMonthlyExpense} onChange={(v) => updateInput('postRetirementMonthlyExpense', parseFloat(v) || 0)} prefix="₹" />
              <InputField label="Inflation Rate" value={(inputs.inflationRate * 100).toFixed(1)} onChange={(v) => updateInput('inflationRate', (parseFloat(v) || 0) / 100)} suffix="%" />
              <InputField label="Start Year" value={inputs.startYear} onChange={(v) => updateInput('startYear', parseInt(v) || 2025)} />
            </div>
          </Card>
        )}

        {/* ── Selected Scenario Lifecycle Chart ─────────────── */}
        {!isCreating && selectedResult && selectedRows.length > 0 && (() => {
          const lifecycleData = selectedRows
            .filter((r) => r.corpusStart >= 0 || r.status === 'accumulating' || r.status === 'retired_here')
            .map((r) => ({
              age: r.age,
              savings: r.savings > 0 ? r.savings : null,
              returns: r.returnOnInvestment > 0 ? r.returnOnInvestment : null,
              withdrawals: r.withdrawals > 0 ? r.withdrawals : null,
              corpus: r.corpusStart > 0 ? r.corpusStart : null,
            }));
          const retireAge = selectedResult.fireAge;
          const labels: Record<string, string> = {
            savings: 'Yearly Savings',
            returns: 'Investment Returns',
            withdrawals: 'Withdrawals (inc. tax)',
            corpus: 'Corpus',
          };
          return (
            <Card>
              <h3 className="text-sm font-semibold text-surface-200 mb-3">
                {selectedResult.simulation?.name ?? 'Scenario'} — Lifecycle
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={lifecycleData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="age" stroke="#52525b" fontSize={11} interval={4} />
                    <YAxis yAxisId="left" stroke="#52525b" fontSize={11} tickFormatter={yFmt} />
                    <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={11} tickFormatter={yFmt} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: '#a1a1aa' }}
                      labelFormatter={(age) => `Age ${age}${Number(age) === retireAge ? ' (Retire)' : ''}`}
                      formatter={(v: any, name: string) => {
                        if (v == null) return ['—', labels[name] ?? name];
                        const usd = usdToInr ? ` (${fmtUsd(v, usdToInr)})` : '';
                        return [`${formatCurrency(v, 'INR')}${usd}`, labels[name] ?? name];
                      }}
                    />
                    <Legend formatter={(v) => labels[v] ?? v} />
                    <ReferenceLine x={retireAge} yAxisId="left" stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'FIRE', position: 'top', fill: '#f59e0b', fontSize: 10 }} />
                    <Area yAxisId="left" type="monotone" dataKey="savings" stackId="flow" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} connectNulls={false} />
                    <Area yAxisId="left" type="monotone" dataKey="returns" stackId="flow" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} connectNulls={false} />
                    <Area yAxisId="left" type="monotone" dataKey="withdrawals" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} connectNulls={false} />
                    <Line yAxisId="right" type="monotone" dataKey="corpus" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })()}

        {/* ── Per-Scenario Simulation Tables ──────────────────── */}
        {comparison && comparison.simulations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <Target className="w-4 h-4 text-surface-400" /> Year-by-Year Simulations
            </h2>
            {comparison.simulations.map((sim, idx) => (
              <ScenarioTable key={sim.id} sim={sim} idx={idx} defaultOpen={activeTab === sim.id} usdToInr={usdToInr} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Monthly Progress ─────────────────────────────────────────────

function MonthlyProgress({ data, usdToInr }: { data: FireMonthlyTargetData; usdToInr: number | null }) {
  const currentMonthKey = todayLocal().slice(0, 7);
  const [view, setView] = useState<'corpus' | 'cashflow'>('corpus');

  // Base scenario (first) for the investment target reference
  const baseScenario = data.scenarios[0];
  const baseInvTarget = baseScenario?.monthlySaving ?? 0;

  const corpusChartData = data.months.map((m) => {
    const point: Record<string, any> = { label: m.label, month: m.month };
    data.scenarios.forEach((s, si) => {
      point[`target_${si}`] = m.targets[s.id] ?? null;
    });
    point.actual = m.actual;
    return point;
  });

  const cashflowChartData = data.months.map((m) => {
    const income = m.income ?? 0;
    const hasData = m.income != null;
    const invTarget = baseScenario ? (m.investmentTargets[baseScenario.id] ?? 0) : 0;
    const expenditureTarget = income > 0 ? income - invTarget : 0;
    const actualExp = hasData ? income - m.actualInvestment : null;
    return {
      label: m.label,
      month: m.month,
      income: m.income,
      investmentTarget: invTarget,
      expenditureTarget: expenditureTarget > 0 ? expenditureTarget : 0,
      actualInvestment: hasData ? m.actualInvestment : null,
      actualExpenditure: actualExp != null && actualExp >= 0 ? actualExp : null,
    };
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-surface-400" /> Monthly Targets — {data.fyLabel}
        </h2>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('cashflow')}
            className={clsx('text-xs px-3 py-1 rounded-md transition-colors',
              view === 'cashflow' ? 'bg-surface-700 text-surface-100' : 'text-surface-400 hover:text-surface-200')}
          >
            Cash Flow
          </button>
          <button
            onClick={() => setView('corpus')}
            className={clsx('text-xs px-3 py-1 rounded-md transition-colors',
              view === 'corpus' ? 'bg-surface-700 text-surface-100' : 'text-surface-400 hover:text-surface-200')}
          >
            Corpus
          </button>
        </div>
      </div>

      {/* ── Cash Flow View ──────────────────────── */}
      {view === 'cashflow' && (
        <>
          {/* Summary cards */}
          {baseScenario && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-lg bg-surface-800/50 border border-surface-700/50 px-3 py-2.5">
                <div className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Investment Target</div>
                <div className="text-lg font-bold text-blue-400 tabular-nums">{fmtLakh(baseInvTarget)}<span className="text-xs text-surface-500 font-normal"> /mo</span></div>
                {usdToInr && <div className="text-[10px] text-surface-500">{fmtUsd(baseInvTarget, usdToInr)}/mo</div>}
                <div className="text-[10px] text-surface-500 mt-0.5">{baseScenario.name}</div>
              </div>
              {(() => {
                const curMonth = data.months.find((m) => m.month === currentMonthKey);
                const income = curMonth?.income ?? 0;
                const expBudget = income > 0 ? income - baseInvTarget : 0;
                return (
                  <>
                    <div className="rounded-lg bg-surface-800/50 border border-surface-700/50 px-3 py-2.5">
                      <div className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Expenditure Budget</div>
                      <div className="text-lg font-bold text-amber-400 tabular-nums">{income > 0 ? fmtLakh(expBudget) : '—'}<span className="text-xs text-surface-500 font-normal"> /mo</span></div>
                      {usdToInr && income > 0 && <div className="text-[10px] text-surface-500">{fmtUsd(expBudget, usdToInr)}/mo</div>}
                      <div className="text-[10px] text-surface-500 mt-0.5">Income − Investment</div>
                    </div>
                    <div className="rounded-lg bg-surface-800/50 border border-surface-700/50 px-3 py-2.5">
                      <div className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Actual Invested</div>
                      <div className={clsx('text-lg font-bold tabular-nums', (curMonth?.actualInvestment ?? 0) >= baseInvTarget ? 'text-green-400' : 'text-red-400')}>
                        {fmtLakh(curMonth?.actualInvestment ?? 0)}
                      </div>
                      {usdToInr && <div className="text-[10px] text-surface-500">{fmtUsd(curMonth?.actualInvestment ?? 0, usdToInr)}</div>}
                      <div className="text-[10px] text-surface-500 mt-0.5">This month's buys</div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Cash flow chart */}
          <div className="h-64 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashflowChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#52525b" fontSize={11} interval={0} angle={-30} dy={8} />
                <YAxis stroke="#52525b" fontSize={11} tickFormatter={yFmt} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: any, name: string) => {
                    if (v == null) return ['—', name];
                    const labels: Record<string, string> = {
                      income: 'Income',
                      investmentTarget: 'Inv. Target',
                      expenditureTarget: 'Exp. Budget',
                      actualInvestment: 'Saved',
                      actualExpenditure: 'Actual Expenditure',
                    };
                    const usd = usdToInr ? ` (${fmtUsd(v, usdToInr)})` : '';
                    return [`${formatCurrency(v, 'INR')}${usd}`, labels[name] ?? name];
                  }}
                />
                <Legend
                  formatter={(v: string) => ({
                    income: 'Income',
                    investmentTarget: 'Inv. Target',
                    expenditureTarget: 'Exp. Budget',
                    actualInvestment: 'Saved',
                    actualExpenditure: 'Actual Expenditure',
                  }[v] ?? v)}
                />
                <Bar dataKey="income" fill="#a78bfa" fillOpacity={0.3} maxBarSize={24} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="investmentTarget" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                <Line type="monotone" dataKey="expenditureTarget" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                <Bar dataKey="actualInvestment" fill="#22c55e" fillOpacity={0.7} maxBarSize={24} radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Cash flow table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-2 px-2 text-left text-surface-500 font-medium">Month</th>
                  <th className="py-2 px-2 text-right text-purple-400 font-medium">Income</th>
                  <th className="py-2 px-2 text-right text-blue-400 font-medium">Inv. Target</th>
                  <th className="py-2 px-2 text-right text-green-400 font-medium">Saved</th>
                  <th className="py-2 px-2 text-right text-amber-400 font-medium">Exp. Budget</th>
                  <th className="py-2 px-2 text-right text-surface-300 font-medium">Actual Exp.</th>
                  <th className="py-2 px-2 text-right text-surface-500 font-medium">Saving Surplus</th>
                  <th className="py-2 px-2 text-right text-surface-500 font-medium">Spend Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const isPast = m.month <= currentMonthKey;
                  const income = m.income ?? 0;
                  const invTarget = baseScenario ? (m.investmentTargets[baseScenario.id] ?? 0) : 0;
                  const expBudget = income > 0 ? income - invTarget : 0;
                  const hasData = m.income != null;
                  const actualExp = hasData ? income - m.actualInvestment : null;
                  const invOk = m.actualInvestment >= invTarget;
                  const savingSurplus = hasData ? m.actualInvestment - invTarget : null;
                  const spendMargin = hasData && actualExp != null && expBudget > 0 ? expBudget - actualExp : null;
                  return (
                    <tr
                      key={m.month}
                      className={clsx(
                        'border-b border-surface-800/40 transition-colors',
                        m.month === currentMonthKey && 'bg-brand-500/5',
                        !isPast && 'opacity-40',
                      )}
                    >
                      <td className="py-1.5 px-2 text-surface-300 font-medium whitespace-nowrap">
                        {m.label}
                        {m.month === currentMonthKey && (
                          <span className="ml-1.5 text-[9px] font-bold text-brand-400 uppercase">Now</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-purple-400/80">
                        {hasData ? fmtLakh(income) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-blue-400/80">
                        {fmtLakh(invTarget)}
                      </td>
                      <td className={clsx('py-1.5 px-2 text-right tabular-nums font-medium',
                        hasData ? (invOk ? 'text-green-400' : 'text-red-400') : 'text-surface-600')}>
                        {hasData ? fmtLakh(m.actualInvestment) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-amber-400/80">
                        {income > 0 ? fmtLakh(expBudget) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-surface-300">
                        {actualExp != null && actualExp >= 0 ? fmtLakh(actualExp) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {savingSurplus != null ? (
                          <span className={clsx('text-[10px] font-medium', savingSurplus >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {savingSurplus >= 0 ? '+' : ''}{fmtLakh(savingSurplus)}
                          </span>
                        ) : isPast ? (
                          <span className="text-[10px] text-surface-600">No data</span>
                        ) : (
                          <span className="text-[10px] text-surface-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {spendMargin != null ? (
                          <span className={clsx('text-[10px] font-medium', spendMargin >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {spendMargin >= 0 ? '+' : ''}{fmtLakh(spendMargin)}
                          </span>
                        ) : isPast ? (
                          <span className="text-[10px] text-surface-600">No data</span>
                        ) : (
                          <span className="text-[10px] text-surface-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(() => {
                const filled = data.months.filter((m) => m.income != null);
                if (filled.length === 0) return null;
                const totIncome = filled.reduce((s, m) => s + (m.income ?? 0), 0);
                const totInvTarget = filled.reduce((s, m) => s + (baseScenario ? (m.investmentTargets[baseScenario.id] ?? 0) : 0), 0);
                const totSaved = filled.reduce((s, m) => s + m.actualInvestment, 0);
                const totExpBudget = filled.reduce((s, m) => {
                  const inc = m.income ?? 0;
                  const tgt = baseScenario ? (m.investmentTargets[baseScenario.id] ?? 0) : 0;
                  return s + (inc > 0 ? inc - tgt : 0);
                }, 0);
                const totActualExp = filled.reduce((s, m) => s + ((m.income ?? 0) - m.actualInvestment), 0);
                const totSavSurplus = totSaved - totInvTarget;
                const totSpendMargin = totExpBudget - totActualExp;
                return (
                  <tfoot>
                    <tr className="border-t-2 border-surface-700">
                      <td className="py-2 px-2 text-surface-100 font-semibold">FY Total</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-purple-400">{fmtLakh(totIncome)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-blue-400">{fmtLakh(totInvTarget)}</td>
                      <td className={clsx('py-2 px-2 text-right tabular-nums font-semibold', totSaved >= totInvTarget ? 'text-green-400' : 'text-red-400')}>
                        {fmtLakh(totSaved)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-amber-400">{fmtLakh(totExpBudget)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-surface-200">{fmtLakh(totActualExp)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        <span className={clsx('text-[10px] font-bold', totSavSurplus >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {totSavSurplus >= 0 ? '+' : ''}{fmtLakh(totSavSurplus)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        <span className={clsx('text-[10px] font-bold', totSpendMargin >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {totSpendMargin >= 0 ? '+' : ''}{fmtLakh(totSpendMargin)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </>
      )}

      {/* ── Corpus View ─────────────────────────── */}
      {view === 'corpus' && (
        <>
          <div className="h-64 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={corpusChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#52525b" fontSize={11} interval={0} angle={-30} dy={8} />
                <YAxis stroke="#52525b" fontSize={11} tickFormatter={yFmt} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: any, name: string) => {
                    if (v == null) return ['—', name];
                    const usd = usdToInr ? ` (${fmtUsd(v, usdToInr)})` : '';
                    if (name === 'actual') return [`${formatCurrency(v, 'INR')}${usd}`, 'Actual Portfolio'];
                    const idx = parseInt(name.split('_')[1]);
                    return [`${formatCurrency(v, 'INR')}${usd}`, data.scenarios[idx]?.name ?? name];
                  }}
                />
                <Legend
                  formatter={(v) =>
                    v === 'actual' ? 'Actual Portfolio' : data.scenarios[parseInt(v.split('_')[1])]?.name ?? v
                  }
                />
                {data.scenarios.map((_, idx) => (
                  <Line
                    key={`target_${idx}`}
                    type="monotone"
                    dataKey={`target_${idx}`}
                    stroke={scenarioColor(idx)}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    connectNulls
                  />
                ))}
                <Bar dataKey="actual" fill={ACTUAL_COLOR} maxBarSize={28} radius={[4, 4, 0, 0]}>
                  {corpusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.actual != null ? ACTUAL_COLOR : 'transparent'}
                      fillOpacity={entry.actual != null ? 0.85 : 0}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800">
                  <th className="py-2 px-2 text-left text-surface-500 font-medium">Month</th>
                  {data.scenarios.map((s, idx) => (
                    <th key={s.id} className="py-2 px-2 text-right font-medium" style={{ color: scenarioColor(idx) }}>
                      {s.name}
                    </th>
                  ))}
                  <th className="py-2 px-2 text-right text-surface-500 font-medium">Actual</th>
                  {data.scenarios.map((s) => (
                    <th key={`gap-${s.id}`} className="py-2 px-2 text-right text-surface-500 font-medium">
                      Gap ({s.name.replace(' FIRE', '')})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const isPast = m.month <= currentMonthKey;
                  return (
                    <tr
                      key={m.month}
                      className={clsx(
                        'border-b border-surface-800/40 transition-colors',
                        m.month === currentMonthKey && 'bg-brand-500/5',
                        !isPast && 'opacity-40',
                      )}
                    >
                      <td className="py-1.5 px-2 text-surface-300 font-medium whitespace-nowrap">
                        {m.label}
                        {m.month === currentMonthKey && (
                          <span className="ml-1.5 text-[9px] font-bold text-brand-400 uppercase">Now</span>
                        )}
                      </td>
                      {data.scenarios.map((s) => (
                        <td key={s.id} className="py-1.5 px-2 text-right tabular-nums text-surface-400">
                          {fmtLakh(m.targets[s.id] ?? 0)}
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-right tabular-nums font-medium text-surface-100">
                        {m.actual != null ? fmtLakh(m.actual) : '—'}
                      </td>
                      {data.scenarios.map((s) => {
                        const target = m.targets[s.id] ?? 0;
                        if (m.actual == null || target <= 0) {
                          return (
                            <td key={`gap-${s.id}`} className="py-1.5 px-2 text-right">
                              <span className="text-[10px] text-surface-600">{isPast ? 'No data' : '—'}</span>
                            </td>
                          );
                        }
                        const diff = m.actual - target;
                        return (
                          <td key={`gap-${s.id}`} className="py-1.5 px-2 text-right tabular-nums">
                            <span className={clsx('text-[10px] font-medium', diff >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {diff >= 0 ? '+' : ''}{fmtLakh(diff)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Scenario Card with Editable Params ───────────────────────────

function ScenarioCard({ sim, idx, isActive, usdToInr, onSelect, onSave, onDelete }: {
  sim: FireComparisonData['simulations'][number]; idx: number; isActive: boolean;
  usdToInr: number | null;
  onSelect: () => void;
  onSave: (updates: Partial<FireSimulationInput>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<FireSimulationInput>>({});
  const s = sim.simulation;
  const corpus = getCorpusAtRetirement(sim.rows);
  const fundsAge = getFundsLastAge(sim.rows, s.lifeExpectancy);
  const covered = fundsAge >= s.lifeExpectancy;

  const startEdit = () => {
    setDraft({
      retirementAge: s.retirementAge, lifeExpectancy: s.lifeExpectancy,
      currentSavings: s.currentSavings, monthlySaving: s.monthlySaving,
      annualSavingsIncrease: s.annualSavingsIncrease, returnOnInvestment: s.returnOnInvestment,
      capitalGainTax: s.capitalGainTax, postRetirementMonthlyExpense: s.postRetirementMonthlyExpense,
      inflationRate: s.inflationRate, startYear: s.startYear, currentAge: s.currentAge,
    });
    setEditing(true);
  };

  const handleSave = () => { onSave(draft); setEditing(false); };
  const set = (k: keyof FireSimulationInput, v: number) => setDraft((d) => ({ ...d, [k]: v }));

  const params = [
    { label: 'Retire At', key: 'retirementAge' as const, val: s.retirementAge, suffix: ' yrs', fmt: (v: number) => `Age ${v}`, isCurrency: false },
    { label: 'Monthly Expense', key: 'postRetirementMonthlyExpense' as const, val: s.postRetirementMonthlyExpense, prefix: '₹', fmt: (v: number) => fmtLakh(v), isCurrency: true },
    { label: 'Monthly Saving', key: 'monthlySaving' as const, val: s.monthlySaving, prefix: '₹', fmt: (v: number) => fmtLakh(v), isCurrency: true },
    { label: 'Savings Increase', key: 'annualSavingsIncrease' as const, val: s.annualSavingsIncrease, suffix: '%', pct: true, fmt: (v: number) => pctDisplay(v), isCurrency: false },
    { label: 'ROI (Pre-Tax)', key: 'returnOnInvestment' as const, val: s.returnOnInvestment, suffix: '%', pct: true, fmt: (v: number) => pctDisplay(v), isCurrency: false },
    { label: 'Capital Gain Tax', key: 'capitalGainTax' as const, val: s.capitalGainTax, suffix: '%', pct: true, fmt: (v: number) => pctDisplay(v), isCurrency: false },
    { label: 'Current Savings', key: 'currentSavings' as const, val: s.currentSavings, prefix: '₹', fmt: (v: number) => fmtLakh(v), isCurrency: true },
    { label: 'Inflation', key: 'inflationRate' as const, val: s.inflationRate, suffix: '%', pct: true, fmt: (v: number) => pctDisplay(v), isCurrency: false },
    { label: 'Start Year', key: 'startYear' as const, val: s.startYear, fmt: (v: number) => String(v), isCurrency: false },
    { label: 'Life Expectancy', key: 'lifeExpectancy' as const, val: s.lifeExpectancy, suffix: ' yrs', fmt: (v: number) => `${v} yrs`, isCurrency: false },
  ];

  return (
    <div onClick={onSelect}
      className={clsx('rounded-xl border p-4 cursor-pointer transition-all',
        isActive ? 'border-surface-600 bg-surface-800/60 ring-1 ring-surface-600' : 'border-surface-800 bg-surface-900/50 hover:border-surface-700')}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scenarioColor(idx) }} />
        <span className="text-surface-100 font-semibold text-sm">{sim.name}</span>
        <span className={clsx(
          'text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
          covered ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
        )}>
          {covered ? 'Sustainable' : `Runs out at ${fundsAge}`}
        </span>
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <>
              <button onClick={handleSave} className="btn btn-primary text-[10px] px-2 py-0.5"><Save className="w-3 h-3" /> Save</button>
              <button onClick={() => setEditing(false)} className="btn btn-secondary text-[10px] px-2 py-0.5">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="text-surface-500 hover:text-surface-300 p-1 rounded hover:bg-surface-700/50"><Settings2 className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-surface-500 hover:text-red-400 p-1 rounded hover:bg-surface-700/50"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-surface-500 mb-0.5">Retire at</div>
          <div className="text-lg font-bold tabular-nums text-surface-100">{s.retirementAge}</div>
          <div className="text-[10px] text-surface-500">{s.retirementAge - s.currentAge > 0 ? `${s.retirementAge - s.currentAge}y from now` : 'Now'}</div>
        </div>
        <div>
          <div className="text-[10px] text-surface-500 mb-0.5">Corpus</div>
          <div className="text-lg font-bold tabular-nums text-green-400">{fmtLakh(corpus)}</div>
          {usdToInr && <div className="text-[10px] text-surface-500 font-medium">{fmtUsd(corpus, usdToInr)}</div>}
          <div className="text-[10px] text-surface-500">at retirement</div>
        </div>
        <div>
          <div className="text-[10px] text-surface-500 mb-0.5">Funds last</div>
          <div className={clsx('text-lg font-bold tabular-nums', covered ? 'text-green-400' : 'text-red-400')}>
            {fundsAge - s.retirementAge}y
          </div>
          <div className="text-[10px] text-surface-500">{covered ? `until ${fundsAge}+` : `ends at ${fundsAge}`}</div>
        </div>
      </div>

      {/* Params grid */}
      <div className="border-t border-surface-800 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {params.map((p) => (
            <div key={p.key} className="flex items-center justify-between">
              <span className="text-[10px] text-surface-500 truncate">{p.label}</span>
              {editing ? (
                <input
                  type="number"
                  value={p.pct ? ((draft[p.key] as number ?? p.val) * 100).toFixed(1) : (draft[p.key] ?? p.val)}
                  onChange={(e) => set(p.key, p.pct ? (parseFloat(e.target.value) || 0) / 100 : parseFloat(e.target.value) || 0)}
                  className="w-20 text-right text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-surface-700 border border-surface-600 text-surface-100 focus:outline-none focus:border-brand-500"
                />
              ) : (
                <span className="text-[11px] tabular-nums text-surface-300 font-medium">
                  {p.fmt(p.val)}
                  {p.isCurrency && usdToInr && <span className="text-[9px] text-surface-500 ml-1">{fmtUsd(p.val, usdToInr)}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Collapsible Scenario Table ───────────────────────────────────

function ScenarioTable({ sim, idx, defaultOpen = false, usdToInr }: {
  sim: FireComparisonData['simulations'][number]; idx: number; defaultOpen?: boolean; usdToInr: number | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const corpus = getCorpusAtRetirement(sim.rows);
  const fundsAge = getFundsLastAge(sim.rows, sim.simulation.lifeExpectancy);

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-800/30 transition-colors">
        {open ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scenarioColor(idx) }} />
        <span className="text-sm text-surface-100 font-semibold">{sim.name}</span>
        <div className="ml-auto flex items-center gap-5 text-[11px] text-surface-500">
          <span>Retire <span className="text-surface-300 font-medium">@{sim.simulation.retirementAge}</span></span>
          <span>Corpus <span className="text-green-400 font-medium">{fmtLakh(corpus)}{usdToInr && <span className="text-surface-500 font-normal ml-1">({fmtUsd(corpus, usdToInr)})</span>}</span></span>
          <span>Lasts <span className={clsx('font-medium', fundsAge >= sim.simulation.lifeExpectancy ? 'text-green-400' : 'text-red-400')}>{fundsAge}+</span></span>
        </div>
      </button>
      {open && (
        <div className="border-t border-surface-800 max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-900 z-10">
              <tr className="border-b border-surface-800">
                {['Year', 'Age', 'Corpus (Start)', 'Savings', 'Returns', 'Withdrawals', 'Monthly', 'Status'].map((h, i) => (
                  <th key={h} className={clsx('py-2 px-2.5 text-surface-500 font-medium',
                    i <= 1 ? 'text-left' : i === 7 ? 'text-center' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sim.rows.map((row) => <SimRow key={row.year} row={row} usdToInr={usdToInr} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Input Field ──────────────────────────────────────────────────

function InputField({ label, value, onChange, type = 'number', prefix, suffix }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: 'text' | 'number'; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] text-surface-500 mb-1 font-medium">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-surface-500 text-xs">{prefix}</span>}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-brand-500 tabular-nums" />
        {suffix && <span className="text-surface-500 text-[10px] whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Table Row ────────────────────────────────────────────────────

function SimRow({ row, usdToInr }: { row: FireSimulationRow; usdToInr: number | null }) {
  const isRet = row.status === 'retired_here';
  const isOut = row.status === 'out_of_funds';
  const isDead = row.status === 'dead';
  const usdSub = (v: number) => usdToInr ? <span className="block text-[9px] text-surface-600">{fmtUsd(v, usdToInr)}</span> : null;

  return (
    <tr className={clsx('border-b border-surface-800/40 transition-colors',
      isRet && 'bg-orange-500/8', isOut && 'bg-red-500/8', isDead && 'opacity-50',
      !isRet && !isOut && !isDead && 'hover:bg-surface-800/20')}>
      <td className="py-1.5 px-2.5 text-surface-400 font-medium">{row.year}</td>
      <td className="py-1.5 px-2.5 text-surface-300">{row.age}</td>
      <td className={clsx('py-1.5 px-2.5 text-right tabular-nums font-medium', row.corpusStart < 0 ? 'text-red-400' : 'text-surface-100')}>
        {fmtLakh(row.corpusStart)}{usdSub(row.corpusStart)}
      </td>
      <td className="py-1.5 px-2.5 text-right tabular-nums text-green-400/80">
        {row.savings > 0 ? <>{fmtLakh(row.savings)}{usdSub(row.savings)}</> : '—'}
      </td>
      <td className="py-1.5 px-2.5 text-right tabular-nums text-blue-400/80">
        {row.returnOnInvestment > 0 ? <>{fmtLakh(row.returnOnInvestment)}{usdSub(row.returnOnInvestment)}</> : '—'}
      </td>
      <td className="py-1.5 px-2.5 text-right tabular-nums text-red-400/80">
        {row.withdrawals > 0 ? <>{fmtLakh(row.withdrawals)}{usdSub(row.withdrawals)}</> : '—'}
      </td>
      <td className="py-1.5 px-2.5 text-right tabular-nums text-surface-500">
        {row.monthlySaving > 0 ? <>{fmtLakh(row.monthlySaving)}{usdSub(row.monthlySaving)}</> : '—'}
      </td>
      <td className="py-1.5 px-2.5 text-center">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: FireSimulationRow['status'] }) {
  const cfg = {
    accumulating: { t: 'Saving', c: 'bg-green-500/15 text-green-400' },
    retired_here: { t: 'RETIRE', c: 'bg-orange-500/20 text-orange-400 font-bold' },
    retired: { t: 'Retired', c: 'bg-blue-500/15 text-blue-400' },
    dead: { t: 'Dead', c: 'bg-surface-700/40 text-surface-500' },
    out_of_funds: { t: 'No Funds', c: 'bg-red-500/15 text-red-400' },
  }[status];
  return <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px]', cfg.c)}>{cfg.t}</span>;
}
