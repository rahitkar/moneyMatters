import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { NetWorthTarget } from '../db/schema.js';

export interface CreateTargetInput {
  name: string;
  startingValue: number;
  monthlyInvestment: number;
  yearlyReturnRate: number;
  stretchMonthlyInvestment?: number;
  startDate: string; // YYYY-MM
  endDate: string;   // YYYY-MM
}

export interface UpdateTargetInput extends Partial<CreateTargetInput> {
  isActive?: boolean;
}

export interface ProjectionRow {
  month: string;
  projectedBase: number;
  projectedStretch: number | null;
  actual: number | null;
  deficitBase: number | null;
  deficitStretch: number | null;
}

function generateMonths(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export const goalService = {
  async getTargets(userId: string): Promise<NetWorthTarget[]> {
    return db
      .select()
      .from(schema.netWorthTargets)
      .where(eq(schema.netWorthTargets.userId, userId))
      .orderBy(desc(schema.netWorthTargets.createdAt));
  },

  async getTargetById(userId: string, id: string): Promise<NetWorthTarget | null> {
    return db
      .select()
      .from(schema.netWorthTargets)
      .where(and(eq(schema.netWorthTargets.id, id), eq(schema.netWorthTargets.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null);
  },

  async createTarget(userId: string, input: CreateTargetInput): Promise<NetWorthTarget> {
    const id = nanoid();
    await db.insert(schema.netWorthTargets).values({
      id,
      userId,
      name: input.name,
      startingValue: input.startingValue,
      monthlyInvestment: input.monthlyInvestment,
      yearlyReturnRate: input.yearlyReturnRate,
      stretchMonthlyInvestment: input.stretchMonthlyInvestment ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: true,
      createdAt: new Date(),
    });
    return (await this.getTargetById(userId, id))!;
  },

  async updateTarget(userId: string, id: string, input: UpdateTargetInput): Promise<NetWorthTarget | null> {
    const existing = await this.getTargetById(userId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.startingValue !== undefined) updates.startingValue = input.startingValue;
    if (input.monthlyInvestment !== undefined) updates.monthlyInvestment = input.monthlyInvestment;
    if (input.yearlyReturnRate !== undefined) updates.yearlyReturnRate = input.yearlyReturnRate;
    if (input.stretchMonthlyInvestment !== undefined) updates.stretchMonthlyInvestment = input.stretchMonthlyInvestment;
    if (input.startDate !== undefined) updates.startDate = input.startDate;
    if (input.endDate !== undefined) updates.endDate = input.endDate;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.netWorthTargets)
        .set(updates as any)
        .where(and(eq(schema.netWorthTargets.id, id), eq(schema.netWorthTargets.userId, userId)));
    }
    return this.getTargetById(userId, id);
  },

  async deleteTarget(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(schema.netWorthTargets)
      .where(and(eq(schema.netWorthTargets.id, id), eq(schema.netWorthTargets.userId, userId)));
    return (result as any).changes > 0;
  },

  async getProjection(userId: string, id: string): Promise<{
    target: NetWorthTarget;
    params: {
      totalYearlyInvestment: number;
      monthlyRate: number;
      delta: number;
      interestEarned: number;
    };
    rows: ProjectionRow[];
  } | null> {
    const target = await this.getTargetById(userId, id);
    if (!target) return null;

    const months = generateMonths(target.startDate, target.endDate);
    const monthlyRate = target.yearlyReturnRate / 100 / 12;
    const hasStretch = target.stretchMonthlyInvestment != null && target.stretchMonthlyInvestment > 0;

    // Load actual portfolio snapshots for the date range
    const snapshots = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.userId, userId));
    const snapshotMap = new Map<string, number>();
    for (const s of snapshots) {
      const ym = s.snapshotDate.slice(0, 7); // YYYY-MM
      // Keep the latest snapshot for each month
      if (!snapshotMap.has(ym) || s.snapshotDate > (snapshotMap.get(ym + '_date') ?? '')) {
        snapshotMap.set(ym, s.totalValue);
        snapshotMap.set(ym + '_date', s.snapshotDate as any);
      }
    }

    const rows: ProjectionRow[] = [];
    let prevBase = target.startingValue;
    let prevStretch = target.startingValue;

    for (const month of months) {
      const projectedBase = prevBase * (1 + monthlyRate) + target.monthlyInvestment;
      const projectedStretch = hasStretch
        ? prevStretch * (1 + monthlyRate) + target.stretchMonthlyInvestment!
        : null;

      const actual = snapshotMap.get(month) as number | undefined ?? null;

      rows.push({
        month,
        projectedBase: Math.round(projectedBase),
        projectedStretch: projectedStretch != null ? Math.round(projectedStretch) : null,
        actual: actual != null ? Math.round(actual) : null,
        deficitBase: actual != null ? Math.round(projectedBase - actual) : null,
        deficitStretch: projectedStretch != null && actual != null
          ? Math.round(projectedStretch - actual)
          : null,
      });

      prevBase = projectedBase;
      if (projectedStretch != null) prevStretch = projectedStretch;
    }

    const totalMonths = months.length;
    const totalYearlyInvestment = target.monthlyInvestment * 12;
    const finalBase = rows[rows.length - 1]?.projectedBase ?? target.startingValue;
    const delta = finalBase - target.startingValue;
    const interestEarned = delta - target.monthlyInvestment * totalMonths;

    return {
      target,
      params: {
        totalYearlyInvestment,
        monthlyRate,
        delta: Math.round(delta),
        interestEarned: Math.round(interestEarned),
      },
      rows,
    };
  },
};
