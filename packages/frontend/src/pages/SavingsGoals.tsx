import { useState, useMemo } from 'react';
import {
  Target, Plus, ChevronDown, ChevronUp, Check, Trash2,
  ExternalLink, Calendar, TrendingUp, Wallet, Award, AlertTriangle,
  Edit3, LinkIcon, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  useSavingsGoals, useSavingsGoalBuckets, useGoalProgressAll,
  useGoalContributions, useGoalAllocations,
  useCreateSavingsGoal, useUpdateSavingsGoal, useDeleteSavingsGoal,
  useCompleteSavingsGoal, useCreateSavingsGoalBucket,
  useDeleteSavingsGoalBucket, useOverrideContribution,
  useRecordAllocations,
} from '../api/hooks';
import { formatCurrency, formatPercent } from '../lib/format';
import type { SavingsGoal, SavingsGoalBucket, GoalLink, GoalContribution, GoalProgress } from '../api/types';

const BUCKET_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a855f7',
];

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function parseLinks(linksJson: string | null): GoalLink[] {
  if (!linksJson) return [];
  try { return JSON.parse(linksJson); } catch { return []; }
}

// ── Goal Form Modal ─────────────────────────────────────────────

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: SavingsGoal | null;
  buckets: SavingsGoalBucket[];
}

function GoalFormModal({ isOpen, onClose, goal, buckets }: GoalFormProps) {
  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();

  const [name, setName] = useState(goal?.name ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount?.toString() ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [savingsPercent, setSavingsPercent] = useState(goal?.savingsPercent?.toString() ?? '0');
  const [bucketId, setBucketId] = useState(goal?.bucketId ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? '');
  const [links, setLinks] = useState<GoalLink[]>(parseLinks(goal?.links ?? null));
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name,
      description: description || undefined,
      targetAmount: parseFloat(targetAmount) || 0,
      deadline: deadline || null,
      savingsPercent: parseFloat(savingsPercent) || 0,
      bucketId: bucketId || null,
      icon: icon || undefined,
      links: links.length > 0 ? JSON.stringify(links) : undefined,
    };

    if (goal) {
      await updateGoal.mutateAsync({ id: goal.id, ...data });
    } else {
      await createGoal.mutateAsync(data);
    }
    onClose();
  };

  const addLink = () => {
    if (newLinkUrl.trim()) {
      setLinks([...links, { label: newLinkLabel.trim() || newLinkUrl.trim(), url: newLinkUrl.trim() }]);
      setNewLinkLabel('');
      setNewLinkUrl('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? 'Edit Goal' : 'New Goal'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-surface-400 mb-1">Goal Name</label>
            <input
              className="input w-full" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Trip to Japan" required
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Target Amount (₹)</label>
            <input
              className="input w-full" type="number" value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)} placeholder="200000" required
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Deadline</label>
            <input
              className="input w-full" type="date" value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Savings % of Monthly Surplus</label>
            <input
              className="input w-full" type="number" min="0" max="100" step="0.5"
              value={savingsPercent} onChange={(e) => setSavingsPercent(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Bucket</label>
            <select className="input w-full" value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
              <option value="">No bucket</option>
              {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Icon (emoji)</label>
            <input className="input w-full" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎯" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Description / Notes</label>
          <textarea
            className="input w-full" rows={3} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="Details about this goal..."
          />
        </div>

        {/* Links */}
        <div>
          <label className="block text-xs text-surface-400 mb-1">Links</label>
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-3 h-3 text-surface-500 shrink-0" />
              <a href={link.url} target="_blank" rel="noreferrer" className="text-sm text-brand-400 hover:underline truncate">
                {link.label}
              </a>
              <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="text-surface-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input className="input flex-1 text-sm" placeholder="Label" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} />
            <input className="input flex-1 text-sm" placeholder="URL" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} />
            <button type="button" onClick={addLink} className="btn btn-secondary text-xs px-3">Add</button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={createGoal.isPending || updateGoal.isPending}>
            {goal ? 'Update' : 'Create'} Goal
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Bucket Form Modal ───────────────────────────────────────────

function BucketFormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createBucket = useCreateSavingsGoalBucket();
  const [name, setName] = useState('');
  const [color, setColor] = useState(BUCKET_COLORS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBucket.mutateAsync({ name, color });
    setName('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Bucket" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-surface-400 mb-1">Name</label>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Travel" required />
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1">Color</label>
          <div className="flex gap-2 flex-wrap">
            {BUCKET_COLORS.map((c) => (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                className={clsx('w-7 h-7 rounded-full transition-all', color === c && 'ring-2 ring-offset-2 ring-offset-surface-900')}
                style={{ backgroundColor: c, ...(color === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={createBucket.isPending}>Create</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Goal Detail Panel ───────────────────────────────────────────

function GoalDetailPanel({
  goal, buckets, onClose,
}: { goal: SavingsGoal; buckets: SavingsGoalBucket[]; onClose: () => void }) {
  const { data: contributions } = useGoalContributions(goal.id);
  const { data: progressData } = useGoalProgressAll();
  const overrideContrib = useOverrideContribution();
  const [overrideMonth, setOverrideMonth] = useState(getCurrentMonth());
  const [overrideAmount, setOverrideAmount] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);

  const progress = progressData?.goals.find((g) => g.goalId === goal.id);
  const links = parseLinks(goal.links);
  const bucket = buckets.find((b) => b.id === goal.bucketId);

  const chartData = useMemo(() => {
    if (!contributions || contributions.length === 0) return [];
    let cumulative = 0;
    return contributions.map((c: GoalContribution) => {
      cumulative += c.manualAmount ?? c.autoAmount;
      return { month: c.entryMonth, saved: cumulative, target: goal.targetAmount };
    });
  }, [contributions, goal.targetAmount]);

  const handleOverride = async () => {
    const amount = parseFloat(overrideAmount);
    if (isNaN(amount)) return;
    await overrideContrib.mutateAsync({ goalId: goal.id, month: overrideMonth, amount });
    setOverrideAmount('');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative ml-auto w-full max-w-xl glass h-full overflow-y-auto animate-slide-up">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {goal.icon && <span className="text-3xl">{goal.icon}</span>}
                <div>
                  <h2 className="text-xl font-bold text-surface-100">{goal.name}</h2>
                  {bucket && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${bucket.color}30`, color: bucket.color ?? '#999' }}>
                      {bucket.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEditForm(true)} className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Progress */}
            {progress && (
              <Card className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-surface-400">Saved</span>
                  <span className="text-surface-100 font-medium">{formatCurrency(progress.totalSaved, 'INR')} / {formatCurrency(progress.targetAmount, 'INR')}</span>
                </div>
                <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all duration-500', progress.isOnTrack ? 'bg-green-500' : 'bg-amber-500')}
                    style={{ width: `${Math.min(100, progress.percentComplete)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-surface-500 mt-1">
                  <span>{formatPercent(progress.percentComplete)} complete</span>
                  <span>{formatCurrency(progress.remaining, 'INR')} remaining</span>
                </div>
                {progress.daysRemaining !== null && (
                  <p className="text-xs text-surface-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {progress.daysRemaining} days remaining
                    {!progress.isOnTrack && <span className="text-amber-400 ml-1">(behind schedule)</span>}
                  </p>
                )}
              </Card>
            )}

            {/* Description */}
            {goal.description && (
              <Card className="mb-4">
                <p className="text-sm text-surface-300 whitespace-pre-wrap">{goal.description}</p>
              </Card>
            )}

            {/* Links */}
            {links.length > 0 && (
              <Card className="mb-4">
                <h3 className="text-sm font-medium text-surface-300 mb-2">Links</h3>
                <div className="space-y-1.5">
                  {links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Allocation info */}
            <Card className="mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-surface-500" />
                <span className="text-surface-400">Monthly allocation:</span>
                <span className="text-surface-100 font-medium">{goal.savingsPercent}%</span>
                <span className="text-surface-500">of savings</span>
              </div>
            </Card>

            {/* Manual Override */}
            <Card className="mb-4">
              <h3 className="text-sm font-medium text-surface-300 mb-3">Manual Override</h3>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" type="month" value={overrideMonth} onChange={(e) => setOverrideMonth(e.target.value)} />
                <input className="input w-28 text-sm" type="number" placeholder="Amount" value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)} />
                <button onClick={handleOverride} className="btn btn-primary text-sm px-3" disabled={overrideContrib.isPending}>Save</button>
              </div>
            </Card>

            {/* Progress Chart */}
            {chartData.length > 1 && (
              <Card className="mb-4">
                <h3 className="text-sm font-medium text-surface-300 mb-3">Progress Over Time</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: any) => [formatCurrency(value, 'INR'), '']}
                    />
                    <Area type="monotone" dataKey="target" stroke="#475569" fill="none" strokeDasharray="5 5" name="Target" />
                    <Area type="monotone" dataKey="saved" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} name="Saved" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Contribution History */}
            {contributions && contributions.length > 0 && (
              <Card>
                <h3 className="text-sm font-medium text-surface-300 mb-3">Contribution History</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      <th className="text-left text-surface-500 py-2 font-normal">Month</th>
                      <th className="text-right text-surface-500 py-2 font-normal">Auto</th>
                      <th className="text-right text-surface-500 py-2 font-normal">Manual</th>
                      <th className="text-right text-surface-500 py-2 font-normal">Effective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((c: GoalContribution) => (
                      <tr key={c.id} className="border-b border-surface-800">
                        <td className="py-2 text-surface-300">{c.entryMonth}</td>
                        <td className="py-2 text-right text-surface-400 tabular-nums">{formatCurrency(c.autoAmount, 'INR')}</td>
                        <td className="py-2 text-right tabular-nums">
                          {c.manualAmount != null
                            ? <span className="text-brand-400">{formatCurrency(c.manualAmount, 'INR')}</span>
                            : <span className="text-surface-600">—</span>}
                        </td>
                        <td className="py-2 text-right text-surface-100 font-medium tabular-nums">
                          {formatCurrency(c.manualAmount ?? c.autoAmount, 'INR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>
      </div>
      {showEditForm && (
        <GoalFormModal isOpen onClose={() => setShowEditForm(false)} goal={goal} buckets={buckets} />
      )}
    </>
  );
}

// ── Goal Card ───────────────────────────────────────────────────

function GoalCard({
  goal, progress, onClick, onComplete, onDelete,
}: {
  goal: SavingsGoal;
  progress?: { totalSaved: number; percentComplete: number; remaining: number; daysRemaining: number | null; isOnTrack: boolean };
  onClick: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={clsx(
        'cursor-pointer hover:ring-1 hover:ring-brand-500/30 transition-all',
        goal.isCompleted && 'opacity-60'
      )}
      padding="sm"
    >
      <div className="flex items-start gap-3" onClick={onClick}>
        <div className="text-2xl shrink-0 mt-0.5">{goal.icon || '🎯'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={clsx('font-medium text-surface-100 truncate', goal.isCompleted && 'line-through')}>
              {goal.name}
            </h3>
            {goal.isCompleted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Done</span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            {formatCurrency(progress?.totalSaved ?? 0, 'INR')} / {formatCurrency(goal.targetAmount, 'INR')}
            {goal.savingsPercent > 0 && <span className="ml-2 text-brand-400">{goal.savingsPercent}%</span>}
          </p>
          {/* Progress bar */}
          <div className="h-1.5 bg-surface-700 rounded-full mt-2 overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                goal.isCompleted ? 'bg-green-500' : progress?.isOnTrack !== false ? 'bg-brand-500' : 'bg-amber-500'
              )}
              style={{ width: `${Math.min(100, progress?.percentComplete ?? 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-surface-500">
              {formatPercent(progress?.percentComplete ?? 0)}
            </span>
            {goal.deadline && (
              <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
                <Calendar className="w-2.5 h-2.5" />
                {progress?.daysRemaining ?? daysUntil(goal.deadline)}d left
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Actions */}
      <div className="flex justify-end gap-1 mt-2 border-t border-surface-800 pt-2" onClick={(e) => e.stopPropagation()}>
        {!goal.isCompleted && (
          <button onClick={onComplete} className="p-1.5 rounded text-surface-500 hover:text-green-400 hover:bg-green-500/10" title="Mark complete">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onDelete} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-red-500/10" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function SavingsGoals() {
  const { data: goals, isLoading: goalsLoading } = useSavingsGoals();
  const { data: buckets, isLoading: bucketsLoading } = useSavingsGoalBuckets();
  const { data: progressData } = useGoalProgressAll();
  const currentMonth = getCurrentMonth();
  const { data: allocations } = useGoalAllocations(currentMonth);

  const completeGoal = useCompleteSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();
  const deleteBucket = useDeleteSavingsGoalBucket();
  const recordAlloc = useRecordAllocations();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showBucketForm, setShowBucketForm] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [detailGoal, setDetailGoal] = useState<SavingsGoal | null>(null);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());

  const progressMap = useMemo(() => {
    const map = new Map<string, GoalProgress>();
    for (const p of progressData?.goals ?? []) {
      map.set(p.goalId, p);
    }
    return map;
  }, [progressData]);

  const goalsByBucket = useMemo(() => {
    const map = new Map<string | null, SavingsGoal[]>();
    for (const g of goals ?? []) {
      const key = g.bucketId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return map;
  }, [goals]);

  const toggleBucket = (id: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (goalsLoading || bucketsLoading) return <LoadingPage />;

  const summary = progressData?.summary;

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Savings Goals</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowBucketForm(true)} className="btn btn-secondary text-sm">
            <Plus className="w-4 h-4 mr-1" /> Bucket
          </button>
          <button onClick={() => { setEditGoal(null); setShowGoalForm(true); }} className="btn btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" /> Goal
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
          <StatCard
            label="Total Target"
            value={formatCurrency(summary.totalTarget, 'INR')}
            subValue={`${summary.activeCount} active goals`}
            icon={Target}
            variant="brand"
          />
          <StatCard
            label="Total Saved"
            value={formatCurrency(summary.totalSaved, 'INR')}
            subValue={summary.totalTarget > 0 ? `${formatPercent((summary.totalSaved / summary.totalTarget) * 100)} of target` : undefined}
            icon={Wallet}
            variant="accent"
          />
          <StatCard
            label="On Track"
            value={`${summary.onTrack}`}
            subValue={summary.behind > 0 ? `${summary.behind} behind` : 'All on track'}
            icon={summary.behind > 0 ? AlertTriangle : TrendingUp}
            isPositive={summary.behind === 0}
          />
          <StatCard
            label="Completed"
            value={`${summary.completed}`}
            icon={Award}
            variant="accent"
          />
        </div>
      )}

      {/* Monthly Allocation Banner */}
      {allocations && allocations.allocations.length > 0 && (
        <Card className="mb-6 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-surface-300">
                Monthly Allocation ({currentMonth})
              </h3>
              <p className="text-xs text-surface-500">
                Savings: {formatCurrency(allocations.monthlySavings, 'INR')} · {allocations.totalAllocatedPercent}% allocated
              </p>
            </div>
            <button
              onClick={() => recordAlloc.mutate({ month: currentMonth })}
              className="btn btn-secondary text-xs"
              disabled={recordAlloc.isPending}
            >
              Record Allocations
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {allocations.allocations.map((a) => (
              <div key={a.goalId} className="text-xs bg-surface-800 rounded-lg px-3 py-2">
                <span className="text-surface-300">{a.goalName}</span>
                <span className="text-surface-100 font-medium ml-2">{formatCurrency(a.allocatedAmount, 'INR')}</span>
                <span className="text-surface-500 ml-1">({a.savingsPercent}%)</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Goals */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
        {(!goals || goals.length === 0) ? (
          <EmptyState
            title="No savings goals yet"
            description="Create your first goal to start tracking progress toward what matters."
            icon={Target}
            action={<button onClick={() => { setEditGoal(null); setShowGoalForm(true); }} className="btn btn-primary">Create Goal</button>}
          />
        ) : (
          <>
            {/* Bucketed goals */}
            {(buckets ?? []).map((bucket) => {
              const bucketGoals = goalsByBucket.get(bucket.id) ?? [];
              if (bucketGoals.length === 0) return null;
              const isCollapsed = collapsedBuckets.has(bucket.id);
              return (
                <div key={bucket.id}>
                  <div className="flex items-center gap-2 mb-3 cursor-pointer group" onClick={() => toggleBucket(bucket.id)}>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bucket.color ?? '#666' }} />
                    <h2 className="text-lg font-semibold text-surface-200 group-hover:text-surface-100">{bucket.name}</h2>
                    <span className="text-xs text-surface-500">{bucketGoals.length}</span>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronUp className="w-4 h-4 text-surface-500" />}
                    <div className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBucket.mutate(bucket.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-surface-500 hover:text-red-400 transition-opacity"
                      title="Delete bucket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bucketGoals.map((goal) => (
                        <GoalCard
                          key={goal.id} goal={goal}
                          progress={progressMap.get(goal.id)}
                          onClick={() => setDetailGoal(goal)}
                          onComplete={() => completeGoal.mutate(goal.id)}
                          onDelete={() => deleteGoal.mutate(goal.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped goals */}
            {(goalsByBucket.get(null) ?? []).length > 0 && (
              <div>
                {(buckets ?? []).length > 0 && (
                  <h2 className="text-lg font-semibold text-surface-200 mb-3">General</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(goalsByBucket.get(null) ?? []).map((goal) => (
                    <GoalCard
                      key={goal.id} goal={goal}
                      progress={progressMap.get(goal.id)}
                      onClick={() => setDetailGoal(goal)}
                      onComplete={() => completeGoal.mutate(goal.id)}
                      onDelete={() => deleteGoal.mutate(goal.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {(showGoalForm || editGoal) && (
        <GoalFormModal
          isOpen
          onClose={() => { setShowGoalForm(false); setEditGoal(null); }}
          goal={editGoal}
          buckets={buckets ?? []}
        />
      )}
      {showBucketForm && (
        <BucketFormModal isOpen onClose={() => setShowBucketForm(false)} />
      )}
      {detailGoal && (
        <GoalDetailPanel
          goal={detailGoal}
          buckets={buckets ?? []}
          onClose={() => setDetailGoal(null)}
        />
      )}
    </div>
  );
}
