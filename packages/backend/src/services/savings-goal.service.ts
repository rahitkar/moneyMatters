import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { SavingsGoalBucket, SavingsGoal, SavingsGoalContribution } from '../db/schema.js';
import { cashFlowService } from './cash-flow.service.js';

export interface CreateBucketInput {
  name: string;
  color?: string;
}

export interface CreateGoalInput {
  bucketId?: string | null;
  name: string;
  description?: string;
  links?: string; // JSON string
  targetAmount: number;
  currency?: string;
  deadline?: string | null;
  savingsPercent?: number;
  icon?: string;
}

export interface UpdateGoalInput extends Partial<CreateGoalInput> {
  isActive?: boolean;
  isCompleted?: boolean;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  bucketId: string | null;
  bucketName: string | null;
  targetAmount: number;
  totalSaved: number;
  percentComplete: number;
  remaining: number;
  deadline: string | null;
  daysRemaining: number | null;
  isOnTrack: boolean;
  savingsPercent: number;
  icon: string | null;
  isCompleted: boolean;
}

export interface GoalAllocation {
  goalId: string;
  goalName: string;
  savingsPercent: number;
  allocatedAmount: number;
}

export const savingsGoalService = {
  // ── Buckets ──────────────────────────────────────────────────────

  async getBuckets(userId: string): Promise<SavingsGoalBucket[]> {
    return db
      .select()
      .from(schema.savingsGoalBuckets)
      .where(eq(schema.savingsGoalBuckets.userId, userId))
      .orderBy(asc(schema.savingsGoalBuckets.sortOrder));
  },

  async createBucket(userId: string, input: CreateBucketInput): Promise<SavingsGoalBucket> {
    const id = nanoid();
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(schema.savingsGoalBuckets)
      .where(eq(schema.savingsGoalBuckets.userId, userId))
      .then((r) => r[0]?.max ?? -1);

    await db.insert(schema.savingsGoalBuckets).values({
      id,
      userId,
      name: input.name,
      color: input.color ?? null,
      sortOrder: maxOrder + 1,
      createdAt: new Date(),
    });
    return (await db.select().from(schema.savingsGoalBuckets).where(eq(schema.savingsGoalBuckets.id, id)).then((r) => r[0]))!;
  },

  async updateBucket(userId: string, id: string, input: Partial<CreateBucketInput>): Promise<SavingsGoalBucket | null> {
    const existing = await db
      .select()
      .from(schema.savingsGoalBuckets)
      .where(and(eq(schema.savingsGoalBuckets.id, id), eq(schema.savingsGoalBuckets.userId, userId)))
      .then((r) => r[0] ?? null);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.savingsGoalBuckets)
        .set(updates as any)
        .where(eq(schema.savingsGoalBuckets.id, id));
    }
    return db.select().from(schema.savingsGoalBuckets).where(eq(schema.savingsGoalBuckets.id, id)).then((r) => r[0] ?? null);
  },

  async deleteBucket(userId: string, id: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(schema.savingsGoalBuckets)
      .where(and(eq(schema.savingsGoalBuckets.id, id), eq(schema.savingsGoalBuckets.userId, userId)))
      .then((r) => r[0] ?? null);
    if (!existing) return false;

    await db
      .update(schema.savingsGoals)
      .set({ bucketId: null } as any)
      .where(and(eq(schema.savingsGoals.bucketId, id), eq(schema.savingsGoals.userId, userId)));

    await db
      .delete(schema.savingsGoalBuckets)
      .where(and(eq(schema.savingsGoalBuckets.id, id), eq(schema.savingsGoalBuckets.userId, userId)));
    return true;
  },

  // ── Goals ────────────────────────────────────────────────────────

  async getGoals(userId: string): Promise<SavingsGoal[]> {
    return db
      .select()
      .from(schema.savingsGoals)
      .where(eq(schema.savingsGoals.userId, userId))
      .orderBy(asc(schema.savingsGoals.sortOrder));
  },

  async getGoalById(userId: string, id: string): Promise<SavingsGoal | null> {
    return db
      .select()
      .from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, userId)))
      .then((r) => r[0] ?? null);
  },

  async createGoal(userId: string, input: CreateGoalInput): Promise<SavingsGoal> {
    const id = nanoid();
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(schema.savingsGoals)
      .where(eq(schema.savingsGoals.userId, userId))
      .then((r) => r[0]?.max ?? -1);

    await db.insert(schema.savingsGoals).values({
      id,
      userId,
      bucketId: input.bucketId ?? null,
      name: input.name,
      description: input.description ?? null,
      links: input.links ?? null,
      targetAmount: input.targetAmount,
      currency: input.currency ?? 'INR',
      deadline: input.deadline ?? null,
      savingsPercent: input.savingsPercent ?? 0,
      icon: input.icon ?? null,
      sortOrder: maxOrder + 1,
      isActive: true,
      isCompleted: false,
      createdAt: new Date(),
      completedAt: null,
    });
    return (await this.getGoalById(userId, id))!;
  },

  async updateGoal(userId: string, id: string, input: UpdateGoalInput): Promise<SavingsGoal | null> {
    const existing = await this.getGoalById(userId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (input.bucketId !== undefined) updates.bucketId = input.bucketId;
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.links !== undefined) updates.links = input.links;
    if (input.targetAmount !== undefined) updates.targetAmount = input.targetAmount;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.deadline !== undefined) updates.deadline = input.deadline;
    if (input.savingsPercent !== undefined) updates.savingsPercent = input.savingsPercent;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    if (input.isCompleted !== undefined) {
      updates.isCompleted = input.isCompleted;
      updates.completedAt = input.isCompleted ? new Date() : null;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.savingsGoals)
        .set(updates as any)
        .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, userId)));
    }
    return this.getGoalById(userId, id);
  },

  async deleteGoal(userId: string, id: string): Promise<boolean> {
    const existing = await this.getGoalById(userId, id);
    if (!existing) return false;
    await db
      .delete(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, userId)));
    return true;
  },

  async completeGoal(userId: string, id: string): Promise<SavingsGoal | null> {
    return this.updateGoal(userId, id, { isCompleted: true });
  },

  async reorder(
    userId: string,
    items: { id: string; sortOrder: number; type: 'goal' | 'bucket' }[]
  ): Promise<void> {
    for (const item of items) {
      if (item.type === 'bucket') {
        await db
          .update(schema.savingsGoalBuckets)
          .set({ sortOrder: item.sortOrder } as any)
          .where(and(eq(schema.savingsGoalBuckets.id, item.id), eq(schema.savingsGoalBuckets.userId, userId)));
      } else {
        await db
          .update(schema.savingsGoals)
          .set({ sortOrder: item.sortOrder } as any)
          .where(and(eq(schema.savingsGoals.id, item.id), eq(schema.savingsGoals.userId, userId)));
      }
    }
  },

  // ── Contributions & Progress ─────────────────────────────────────

  async getContributions(goalId: string): Promise<SavingsGoalContribution[]> {
    return db
      .select()
      .from(schema.savingsGoalContributions)
      .where(eq(schema.savingsGoalContributions.goalId, goalId))
      .orderBy(asc(schema.savingsGoalContributions.entryMonth));
  },

  async overrideContribution(
    goalId: string,
    month: string,
    amount: number,
    notes?: string
  ): Promise<SavingsGoalContribution> {
    const existing = await db
      .select()
      .from(schema.savingsGoalContributions)
      .where(
        and(
          eq(schema.savingsGoalContributions.goalId, goalId),
          eq(schema.savingsGoalContributions.entryMonth, month)
        )
      )
      .then((r) => r[0] ?? null);

    if (existing) {
      await db
        .update(schema.savingsGoalContributions)
        .set({ manualAmount: amount, ...(notes !== undefined ? { notes } : {}) } as any)
        .where(eq(schema.savingsGoalContributions.id, existing.id));
      return db.select().from(schema.savingsGoalContributions).where(eq(schema.savingsGoalContributions.id, existing.id)).then((r) => r[0]!);
    }

    const id = nanoid();
    await db.insert(schema.savingsGoalContributions).values({
      id,
      goalId,
      entryMonth: month,
      autoAmount: 0,
      manualAmount: amount,
      notes: notes ?? null,
      createdAt: new Date(),
    });
    return db.select().from(schema.savingsGoalContributions).where(eq(schema.savingsGoalContributions.id, id)).then((r) => r[0]!);
  },

  async _getTotalSaved(goalId: string): Promise<number> {
    const contributions = await this.getContributions(goalId);
    return contributions.reduce((sum, c) => {
      const effective = c.manualAmount ?? c.autoAmount;
      return sum + effective;
    }, 0);
  },

  async getGoalProgress(userId: string, goalId: string): Promise<GoalProgress | null> {
    const goal = await this.getGoalById(userId, goalId);
    if (!goal) return null;

    const bucket = goal.bucketId
      ? await db.select().from(schema.savingsGoalBuckets).where(eq(schema.savingsGoalBuckets.id, goal.bucketId)).then((r) => r[0] ?? null)
      : null;

    const totalSaved = await this._getTotalSaved(goalId);
    const remaining = Math.max(0, goal.targetAmount - totalSaved);
    const percentComplete = goal.targetAmount > 0 ? Math.min(100, (totalSaved / goal.targetAmount) * 100) : 0;

    let daysRemaining: number | null = null;
    let isOnTrack = true;
    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (daysRemaining > 0 && !goal.isCompleted) {
        const totalDays = Math.ceil((deadlineDate.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const elapsed = totalDays - daysRemaining;
        const expectedProgress = totalDays > 0 ? (elapsed / totalDays) * 100 : 0;
        isOnTrack = percentComplete >= expectedProgress * 0.9; // 10% buffer
      }
    }

    return {
      goalId: goal.id,
      goalName: goal.name,
      bucketId: goal.bucketId,
      bucketName: bucket?.name ?? null,
      targetAmount: goal.targetAmount,
      totalSaved,
      percentComplete,
      remaining,
      deadline: goal.deadline,
      daysRemaining,
      isOnTrack,
      savingsPercent: goal.savingsPercent,
      icon: goal.icon,
      isCompleted: goal.isCompleted,
    };
  },

  async getAllProgress(userId: string): Promise<{
    goals: GoalProgress[];
    summary: { totalTarget: number; totalSaved: number; onTrack: number; behind: number; completed: number; activeCount: number };
  }> {
    const goals = await this.getGoals(userId);
    const progressList: GoalProgress[] = [];

    for (const goal of goals) {
      const progress = await this.getGoalProgress(userId, goal.id);
      if (progress) progressList.push(progress);
    }

    const activeGoals = progressList.filter((p) => !p.isCompleted);
    return {
      goals: progressList,
      summary: {
        totalTarget: activeGoals.reduce((s, p) => s + p.targetAmount, 0),
        totalSaved: activeGoals.reduce((s, p) => s + p.totalSaved, 0),
        onTrack: activeGoals.filter((p) => p.isOnTrack).length,
        behind: activeGoals.filter((p) => !p.isOnTrack).length,
        completed: progressList.filter((p) => p.isCompleted).length,
        activeCount: activeGoals.length,
      },
    };
  },

  // ── Cash Flow Allocations ────────────────────────────────────────

  async previewAllocations(userId: string, month: string): Promise<{
    monthlyIncome: number;
    totalAllocatedPercent: number;
    totalEarmarked: number;
    allocations: GoalAllocation[];
  }> {
    const summary = await cashFlowService.getMonthSummary(userId, month);
    const monthlyIncome = summary.totals.totalIncome ?? 0;

    const goals = await db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.userId, userId),
          eq(schema.savingsGoals.isActive, true),
          eq(schema.savingsGoals.isCompleted, false)
        )
      );

    const totalAllocatedPercent = goals.reduce((s, g) => s + g.savingsPercent, 0);

    const allocations: GoalAllocation[] = goals
      .filter((g) => g.savingsPercent > 0)
      .map((g) => ({
        goalId: g.id,
        goalName: g.name,
        savingsPercent: g.savingsPercent,
        allocatedAmount: Math.round((monthlyIncome * g.savingsPercent) / 100 * 100) / 100,
      }));

    const totalEarmarked = allocations.reduce((s, a) => s + a.allocatedAmount, 0);

    return { monthlyIncome, totalAllocatedPercent, totalEarmarked, allocations };
  },

  async recordAllocations(userId: string, month: string): Promise<SavingsGoalContribution[]> {
    const { allocations } = await this.previewAllocations(userId, month);
    const results: SavingsGoalContribution[] = [];

    for (const alloc of allocations) {
      const existing = await db
        .select()
        .from(schema.savingsGoalContributions)
        .where(
          and(
            eq(schema.savingsGoalContributions.goalId, alloc.goalId),
            eq(schema.savingsGoalContributions.entryMonth, month)
          )
        )
        .then((r) => r[0] ?? null);

      if (existing) {
        await db
          .update(schema.savingsGoalContributions)
          .set({ autoAmount: alloc.allocatedAmount } as any)
          .where(eq(schema.savingsGoalContributions.id, existing.id));
        results.push(
          await db.select().from(schema.savingsGoalContributions).where(eq(schema.savingsGoalContributions.id, existing.id)).then((r) => r[0]!)
        );
      } else {
        const id = nanoid();
        await db.insert(schema.savingsGoalContributions).values({
          id,
          goalId: alloc.goalId,
          entryMonth: month,
          autoAmount: alloc.allocatedAmount,
          manualAmount: null,
          notes: null,
          createdAt: new Date(),
        });
        results.push(
          await db.select().from(schema.savingsGoalContributions).where(eq(schema.savingsGoalContributions.id, id)).then((r) => r[0]!)
        );
      }
    }

    return results;
  },
};
