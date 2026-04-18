import { eq, and, like, asc, sql, desc, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type {
  CashFlowCategory,
  CashFlowEntry,
  CashFlowSpend,
  MonthlyIncome,
  PaymentMethod,
  CashFlowCategoryType,
  PaymentMethodType,
  ExpenseTag,
} from '../db/schema.js';
import { getCycleMonth, getCycleDateRange, getCycleStartDay } from './cycle.utils.js';
import { transactionService } from './transaction.service.js';

// ── Category CRUD ─────────────────────────────────────────────────

export interface CreateCategoryInput {
  name: string;
  type: CashFlowCategoryType;
  tag?: ExpenseTag;
  defaultBudget?: number;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  tag?: ExpenseTag;
  defaultBudget?: number;
  sortOrder?: number;
}

// ── Entry inputs ──────────────────────────────────────────────────

export interface UpsertEntryInput {
  categoryId: string;
  entryMonth: string; // YYYY-MM
  budget?: number;
  actual?: number;
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────

export const cashFlowService = {
  // ── Categories ────────────────────────────────────────────────

  async getCategories(userId: string): Promise<CashFlowCategory[]> {
    return db
      .select()
      .from(schema.cashFlowCategories)
      .where(eq(schema.cashFlowCategories.userId, userId))
      .orderBy(asc(schema.cashFlowCategories.sortOrder), asc(schema.cashFlowCategories.name));
  },

  async createCategory(userId: string, input: CreateCategoryInput): Promise<CashFlowCategory> {
    const id = nanoid();
    const now = new Date();
    await db.insert(schema.cashFlowCategories).values({
      id,
      userId,
      name: input.name,
      type: input.type,
      tag: input.type === 'expense' ? (input.tag ?? 'need') : null,
      defaultBudget: input.defaultBudget ?? 0,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
    });
    return (await db
      .select()
      .from(schema.cashFlowCategories)
      .where(and(eq(schema.cashFlowCategories.id, id), eq(schema.cashFlowCategories.userId, userId)))
      .limit(1)
      .then((r) => r[0]))!;
  },

  async updateCategory(userId: string, id: string, input: UpdateCategoryInput): Promise<CashFlowCategory | null> {
    const existing = await db
      .select()
      .from(schema.cashFlowCategories)
      .where(and(eq(schema.cashFlowCategories.id, id), eq(schema.cashFlowCategories.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!existing) return null;

    await db
      .update(schema.cashFlowCategories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.tag !== undefined && { tag: input.tag }),
        ...(input.defaultBudget !== undefined && { defaultBudget: input.defaultBudget }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      })
      .where(and(eq(schema.cashFlowCategories.id, id), eq(schema.cashFlowCategories.userId, userId)));

    return db
      .select()
      .from(schema.cashFlowCategories)
      .where(and(eq(schema.cashFlowCategories.id, id), eq(schema.cashFlowCategories.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null);
  },

  async deleteCategory(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(schema.cashFlowCategories)
      .where(and(eq(schema.cashFlowCategories.id, id), eq(schema.cashFlowCategories.userId, userId)));
    return (result as any).changes > 0;
  },

  // ── Entries ───────────────────────────────────────────────────

  async getEntriesForMonth(userId: string, month: string): Promise<CashFlowEntry[]> {
    return db
      .select({
        id: schema.cashFlowEntries.id,
        categoryId: schema.cashFlowEntries.categoryId,
        entryMonth: schema.cashFlowEntries.entryMonth,
        budget: schema.cashFlowEntries.budget,
        actual: schema.cashFlowEntries.actual,
        notes: schema.cashFlowEntries.notes,
        createdAt: schema.cashFlowEntries.createdAt,
      })
      .from(schema.cashFlowEntries)
      .innerJoin(
        schema.cashFlowCategories,
        eq(schema.cashFlowEntries.categoryId, schema.cashFlowCategories.id),
      )
      .where(
        and(eq(schema.cashFlowEntries.entryMonth, month), eq(schema.cashFlowCategories.userId, userId)),
      );
  },

  async upsertEntry(userId: string, input: UpsertEntryInput): Promise<CashFlowEntry> {
    const existing = await db
      .select({ id: schema.cashFlowEntries.id })
      .from(schema.cashFlowEntries)
      .innerJoin(
        schema.cashFlowCategories,
        eq(schema.cashFlowEntries.categoryId, schema.cashFlowCategories.id),
      )
      .where(
        and(
          eq(schema.cashFlowEntries.categoryId, input.categoryId),
          eq(schema.cashFlowEntries.entryMonth, input.entryMonth),
          eq(schema.cashFlowCategories.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(schema.cashFlowEntries)
        .set({
          ...(input.budget !== undefined && { budget: input.budget }),
          ...(input.actual !== undefined && { actual: input.actual }),
          ...(input.notes !== undefined && { notes: input.notes }),
        })
        .where(eq(schema.cashFlowEntries.id, existing.id));
      return db
        .select()
        .from(schema.cashFlowEntries)
        .where(eq(schema.cashFlowEntries.id, existing.id))
        .limit(1)
        .then((r) => r[0])!;
    }

    const id = nanoid();
    await db.insert(schema.cashFlowEntries).values({
      id,
      categoryId: input.categoryId,
      entryMonth: input.entryMonth,
      budget: input.budget ?? 0,
      actual: input.actual ?? 0,
      notes: input.notes ?? null,
      createdAt: new Date(),
    });
    return db
      .select()
      .from(schema.cashFlowEntries)
      .where(eq(schema.cashFlowEntries.id, id))
      .limit(1)
      .then((r) => r[0])!;
  },

  async updateEntry(
    userId: string,
    id: string,
    data: { budget?: number; actual?: number; notes?: string },
  ): Promise<CashFlowEntry | null> {
    const existing = await db
      .select({ id: schema.cashFlowEntries.id })
      .from(schema.cashFlowEntries)
      .innerJoin(
        schema.cashFlowCategories,
        eq(schema.cashFlowEntries.categoryId, schema.cashFlowCategories.id),
      )
      .where(and(eq(schema.cashFlowEntries.id, id), eq(schema.cashFlowCategories.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!existing) return null;

    await db
      .update(schema.cashFlowEntries)
      .set({
        ...(data.budget !== undefined && { budget: data.budget }),
        ...(data.actual !== undefined && { actual: data.actual }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .where(eq(schema.cashFlowEntries.id, id));

    return db
      .select()
      .from(schema.cashFlowEntries)
      .where(eq(schema.cashFlowEntries.id, id))
      .limit(1)
      .then((r) => r[0] ?? null);
  },

  async deleteEntry(userId: string, id: string): Promise<boolean> {
    const existing = await db
      .select({ id: schema.cashFlowEntries.id })
      .from(schema.cashFlowEntries)
      .innerJoin(
        schema.cashFlowCategories,
        eq(schema.cashFlowEntries.categoryId, schema.cashFlowCategories.id),
      )
      .where(and(eq(schema.cashFlowEntries.id, id), eq(schema.cashFlowCategories.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!existing) return false;

    const result = await db
      .delete(schema.cashFlowEntries)
      .where(eq(schema.cashFlowEntries.id, id));
    return (result as any).changes > 0;
  },

  // ── Monthly Income ────────────────────────────────────────────

  async getIncome(userId: string, month: string): Promise<MonthlyIncome | null> {
    return db
      .select()
      .from(schema.monthlyIncome)
      .where(and(eq(schema.monthlyIncome.entryMonth, month), eq(schema.monthlyIncome.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null);
  },

  async upsertMonthConfig(
    userId: string,
    month: string,
    config: {
      openingBalance?: number;
      expenseLimit?: number;
      investmentTarget?: number;
      savingsTarget?: number;
      notes?: string;
    },
  ): Promise<MonthlyIncome> {
    const existing = await this.getIncome(userId, month);
    if (existing) {
      await db
        .update(schema.monthlyIncome)
        .set({
          ...(config.openingBalance !== undefined && { openingBalance: config.openingBalance }),
          ...(config.expenseLimit !== undefined && { expenseLimit: config.expenseLimit }),
          ...(config.investmentTarget !== undefined && { investmentTarget: config.investmentTarget }),
          ...(config.savingsTarget !== undefined && { savingsTarget: config.savingsTarget }),
          ...(config.notes !== undefined && { notes: config.notes }),
        })
        .where(eq(schema.monthlyIncome.id, existing.id));

      if (config.openingBalance !== undefined) {
        await this.applySyncToPortfolio(userId, month).catch((err) => {
          console.warn('Auto-sync to portfolio failed:', err);
        });
      }

      return (await this.getIncome(userId, month))!;
    }

    // Auto-fill targets from most recent previous month if not provided
    let autoTargets = { expenseLimit: null as number | null, investmentTarget: null as number | null, savingsTarget: null as number | null };
    if (!config.expenseLimit && !config.investmentTarget && !config.savingsTarget) {
      const prev = await db
        .select()
        .from(schema.monthlyIncome)
        .where(
          and(sql`${schema.monthlyIncome.entryMonth} < ${month}`, eq(schema.monthlyIncome.userId, userId)),
        )
        .orderBy(desc(schema.monthlyIncome.entryMonth))
        .limit(1)
        .then((r) => r[0]);
      if (prev) {
        autoTargets = {
          expenseLimit: prev.expenseLimit,
          investmentTarget: prev.investmentTarget,
          savingsTarget: prev.savingsTarget,
        };
      }
    }

    const id = nanoid();
    await db.insert(schema.monthlyIncome).values({
      id,
      userId,
      entryMonth: month,
      salary: 0,
      otherIncome: 0,
      openingBalance: config.openingBalance ?? null,
      expenseLimit: config.expenseLimit ?? autoTargets.expenseLimit,
      investmentTarget: config.investmentTarget ?? autoTargets.investmentTarget,
      savingsTarget: config.savingsTarget ?? autoTargets.savingsTarget,
      notes: config.notes ?? null,
      createdAt: new Date(),
    });

    if (config.openingBalance !== undefined) {
      await this.applySyncToPortfolio(userId, month).catch((err) => {
        console.warn('Auto-sync to portfolio failed:', err);
      });
    }

    return (await this.getIncome(userId, month))!;
  },

  // ── Init month (copy defaults) ───────────────────────────────

  async initMonth(userId: string, month: string): Promise<{ created: number }> {
    const categories = await this.getCategories(userId);
    const existingEntries = await this.getEntriesForMonth(userId, month);
    const existingCategoryIds = new Set(existingEntries.map((e) => e.categoryId));

    let created = 0;
    for (const cat of categories) {
      if (existingCategoryIds.has(cat.id)) continue;
      await db.insert(schema.cashFlowEntries).values({
        id: nanoid(),
        categoryId: cat.id,
        entryMonth: month,
        budget: cat.defaultBudget ?? 0,
        actual: 0,
        notes: null,
        createdAt: new Date(),
      });
      created++;
    }
    return { created };
  },

  // ── Payment Methods ──────────────────────────────────────────

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return db
      .select()
      .from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.userId, userId))
      .orderBy(asc(schema.paymentMethods.name));
  },

  async createPaymentMethod(userId: string, name: string, type: PaymentMethodType): Promise<PaymentMethod> {
    const id = nanoid();
    await db
      .insert(schema.paymentMethods)
      .values({ id, userId, name, type, isActive: true, createdAt: new Date() });
    return (await db
      .select()
      .from(schema.paymentMethods)
      .where(and(eq(schema.paymentMethods.id, id), eq(schema.paymentMethods.userId, userId)))
      .limit(1)
      .then((r) => r[0]))!;
  },

  async deletePaymentMethod(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(schema.paymentMethods)
      .where(and(eq(schema.paymentMethods.id, id), eq(schema.paymentMethods.userId, userId)));
    return (result as any).changes > 0;
  },

  // ── Spends (individual expense/income entries) ─────────────

  async getSpendsForMonth(
    userId: string,
    month: string,
  ): Promise<(CashFlowSpend & { categoryName: string; paymentMethodName: string })[]> {
    const rows = await db
      .select({
        id: schema.cashFlowSpends.id,
        userId: schema.cashFlowSpends.userId,
        categoryId: schema.cashFlowSpends.categoryId,
        paymentMethodId: schema.cashFlowSpends.paymentMethodId,
        amount: schema.cashFlowSpends.amount,
        description: schema.cashFlowSpends.description,
        spendDate: schema.cashFlowSpends.spendDate,
        entryMonth: schema.cashFlowSpends.entryMonth,
        type: schema.cashFlowSpends.type,
        createdAt: schema.cashFlowSpends.createdAt,
        categoryName: schema.cashFlowCategories.name,
        paymentMethodName: schema.paymentMethods.name,
      })
      .from(schema.cashFlowSpends)
      .innerJoin(schema.cashFlowCategories, eq(schema.cashFlowSpends.categoryId, schema.cashFlowCategories.id))
      .innerJoin(schema.paymentMethods, eq(schema.cashFlowSpends.paymentMethodId, schema.paymentMethods.id))
      .where(and(eq(schema.cashFlowSpends.entryMonth, month), eq(schema.cashFlowSpends.userId, userId)))
      .orderBy(desc(schema.cashFlowSpends.spendDate));
    return rows;
  },

  async addSpend(
    userId: string,
    input: {
      categoryId: string;
      paymentMethodId: string;
      amount: number;
      description?: string;
      spendDate: string;
      type: CashFlowCategoryType;
    },
  ): Promise<CashFlowSpend> {
    const id = nanoid();
    const cycleDay = await getCycleStartDay(userId);
    const entryMonth = getCycleMonth(input.spendDate, cycleDay);
    await db.insert(schema.cashFlowSpends).values({
      id,
      userId,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      amount: input.amount,
      description: input.description ?? null,
      spendDate: input.spendDate,
      entryMonth,
      type: input.type,
      createdAt: new Date(),
    });
    await this._syncCategoryActual(userId, input.categoryId, entryMonth);
    return (await db.select().from(schema.cashFlowSpends).where(eq(schema.cashFlowSpends.id, id)).limit(1).then((r) => r[0]))!;
  },

  async updateSpend(
    userId: string,
    id: string,
    data: {
      categoryId?: string;
      paymentMethodId?: string;
      amount?: number;
      description?: string;
      spendDate?: string;
    },
  ): Promise<CashFlowSpend | null> {
    const existing = await db
      .select()
      .from(schema.cashFlowSpends)
      .where(and(eq(schema.cashFlowSpends.id, id), eq(schema.cashFlowSpends.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!existing) return null;

    const cycleDay = await getCycleStartDay(userId);
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.description !== undefined) updates.description = data.description;
    if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
    if (data.paymentMethodId !== undefined) updates.paymentMethodId = data.paymentMethodId;

    let newEntryMonth = existing.entryMonth;
    if (data.spendDate !== undefined) {
      updates.spendDate = data.spendDate;
      newEntryMonth = getCycleMonth(data.spendDate, cycleDay);
      updates.entryMonth = newEntryMonth;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(schema.cashFlowSpends).set(updates as any).where(eq(schema.cashFlowSpends.id, id));
    }

    await this._syncCategoryActual(userId, existing.categoryId, existing.entryMonth);
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      await this._syncCategoryActual(userId, data.categoryId, newEntryMonth);
    }
    if (newEntryMonth !== existing.entryMonth) {
      await this._syncCategoryActual(userId, data.categoryId ?? existing.categoryId, newEntryMonth);
    }

    return db.select().from(schema.cashFlowSpends).where(eq(schema.cashFlowSpends.id, id)).limit(1).then((r) => r[0] ?? null);
  },

  async deleteSpend(userId: string, id: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(schema.cashFlowSpends)
      .where(and(eq(schema.cashFlowSpends.id, id), eq(schema.cashFlowSpends.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!existing) return false;
    await db.delete(schema.cashFlowSpends).where(eq(schema.cashFlowSpends.id, id));
    await this._syncCategoryActual(userId, existing.categoryId, existing.entryMonth);
    return true;
  },

  async _syncCategoryActual(userId: string, categoryId: string, month: string): Promise<void> {
    const sumRow = await db
      .select({ total: sql<number>`coalesce(sum(${schema.cashFlowSpends.amount}), 0)` })
      .from(schema.cashFlowSpends)
      .where(
        and(
          eq(schema.cashFlowSpends.categoryId, categoryId),
          eq(schema.cashFlowSpends.entryMonth, month),
          eq(schema.cashFlowSpends.userId, userId),
        ),
      )
      .then((r) => r[0]);
    const total = sumRow?.total ?? 0;

    const entry = await db
      .select({ id: schema.cashFlowEntries.id })
      .from(schema.cashFlowEntries)
      .innerJoin(
        schema.cashFlowCategories,
        eq(schema.cashFlowEntries.categoryId, schema.cashFlowCategories.id),
      )
      .where(
        and(
          eq(schema.cashFlowEntries.categoryId, categoryId),
          eq(schema.cashFlowEntries.entryMonth, month),
          eq(schema.cashFlowCategories.userId, userId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (entry) {
      await db.update(schema.cashFlowEntries).set({ actual: total }).where(eq(schema.cashFlowEntries.id, entry.id));
    } else {
      await db.insert(schema.cashFlowEntries).values({
        id: nanoid(),
        categoryId,
        entryMonth: month,
        budget: 0,
        actual: total,
        notes: null,
        createdAt: new Date(),
      });
    }
  },

  // ── Investment derivation from existing transactions ──────────

  async getInvestmentBreakdown(userId: string, month: string): Promise<{
    investments: { assetId: string; name: string; symbol: string; currency: string; amount: number; foreignQuantity: number | null; fundSourceId: string | null }[];
    walletTransfers: number;
    bankInvestments: number;
  }> {
    const cycleDay = await getCycleStartDay(userId);
    const { start, end } = getCycleDateRange(month, cycleDay);

    const allTx = await db
      .select({
        assetId: schema.transactions.assetId,
        type: schema.transactions.type,
        quantity: schema.transactions.quantity,
        price: schema.transactions.price,
        fees: schema.transactions.fees,
        fundSourceId: schema.transactions.fundSourceId,
        date: schema.transactions.transactionDate,
        assetName: schema.assets.name,
        assetSymbol: schema.assets.symbol,
        assetClass: schema.assets.assetClass,
        assetCurrency: schema.assets.currency,
      })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(
        and(
          eq(schema.assets.userId, userId),
          gte(schema.transactions.transactionDate, start),
          lte(schema.transactions.transactionDate, end),
        ),
      );
    const cashAssets = await db
      .select({ id: schema.assets.id, symbol: schema.assets.symbol })
      .from(schema.assets)
      .where(and(eq(schema.assets.assetClass, 'cash'), eq(schema.assets.userId, userId)));
    const cashAssetIds = new Set(cashAssets.map((a) => a.id));
    const primaryBankId = cashAssets.find((a) => a.symbol.includes('SAVINGS-ACCOUNT'))?.id ?? null;

    const investmentTx: typeof allTx = [];
    let walletTransfers = 0;
    let bankInvestments = 0;

    for (const tx of allTx) {
      if (tx.type !== 'buy') continue;
      // Cash-to-cash transfers (e.g. bank → broker wallet) are money movements, not investments
      if (tx.fundSourceId && cashAssetIds.has(tx.assetId) && cashAssetIds.has(tx.fundSourceId)) {
        if (tx.fundSourceId === primaryBankId) walletTransfers += tx.quantity * tx.price;
        continue;
      }
      // Connected ledger: funded by a cash/bank asset
      if (tx.fundSourceId && cashAssetIds.has(tx.fundSourceId)) {
        investmentTx.push(tx);
        if (tx.fundSourceId === primaryBankId) bankInvestments += tx.quantity * tx.price;
        continue;
      }
      // Legacy fallback: only non-INR cash deposits (e.g. USD wallets) without explicit fund source.
      if (!tx.fundSourceId && tx.assetClass === 'cash' && tx.assetCurrency !== 'INR') { investmentTx.push(tx); continue; }
    }

    const grouped = new Map<string, { name: string; symbol: string; currency: string; amount: number; foreignQuantity: number | null; fundSourceId: string | null }>();
    for (const tx of investmentTx) {
      const isForeign = tx.assetCurrency !== 'INR';
      const existing = grouped.get(tx.assetId) ?? { name: tx.assetName, symbol: tx.assetSymbol, currency: tx.assetCurrency ?? 'INR', amount: 0, foreignQuantity: isForeign ? 0 : null, fundSourceId: tx.fundSourceId };
      existing.amount += tx.quantity * tx.price;
      if (isForeign && existing.foreignQuantity !== null) {
        existing.foreignQuantity += tx.quantity;
      }
      grouped.set(tx.assetId, existing);
    }

    return {
      investments: Array.from(grouped, ([assetId, data]) => ({ assetId, ...data })),
      walletTransfers,
      bankInvestments,
    };
  },

  // Compute the previous month's closing balance for auto-carry
  async _getPreviousClosingBalance(userId: string, month: string): Promise<number | null> {
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevIncome = await this.getIncome(userId, prevMonth);
    if (!prevIncome) return null;

    const prevOpeningBalance = prevIncome.openingBalance;
    if (prevOpeningBalance === null || prevOpeningBalance === undefined) {
      // Try one more level back (recursive auto-carry)
      const deeperClosing = await this._getPreviousClosingBalance(userId, prevMonth);
      if (deeperClosing === null) return null;
      // Re-compute with the carried opening balance
      return this._computeClosingBalance(userId, prevMonth, deeperClosing);
    }

    return this._computeClosingBalance(userId, prevMonth, prevOpeningBalance);
  },

  async _computeClosingBalance(userId: string, month: string, openingBalance: number): Promise<number | null> {
    const spends = await this.getSpendsForMonth(userId, month);
    const incomeFromSpends = spends.filter((s) => s.type === 'income').reduce((s, r) => s + r.amount, 0);
    const prevIncome = await this.getIncome(userId, month);
    const legacyIncome = (prevIncome?.salary ?? 0) + (prevIncome?.otherIncome ?? 0);
    const totalIncome = incomeFromSpends > 0 ? incomeFromSpends : legacyIncome;

    const categories = await this.getCategories(userId);
    const entries = await this.getEntriesForMonth(userId, month);
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const totalExpenses = entries.reduce((sum, e) => {
      const cat = categoryMap.get(e.categoryId);
      if (!cat || cat.type !== 'expense') return sum;
      return sum + (e.actual ?? 0);
    }, 0);

    const breakdown = await this.getInvestmentBreakdown(userId, month);

    return openingBalance + totalIncome - totalExpenses - breakdown.bankInvestments - breakdown.walletTransfers;
  },

  // ── Month summary ─────────────────────────────────────────────

  async getMonthSummary(userId: string, month: string) {
    const [income, entries, categories, investmentBreakdown, spends, paymentMethods] = await Promise.all([
      this.getIncome(userId, month),
      this.getEntriesForMonth(userId, month),
      this.getCategories(userId),
      this.getInvestmentBreakdown(userId, month),
      this.getSpendsForMonth(userId, month),
      this.getPaymentMethods(userId),
    ]);
    const investments = investmentBreakdown.investments;
    const walletTransfers = investmentBreakdown.walletTransfers;
    const bankInvestments = investmentBreakdown.bankInvestments;

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const expenseRows = entries
      .map((e) => {
        const cat = categoryMap.get(e.categoryId);
        if (!cat || cat.type !== 'expense') return null;
        return {
          ...e,
          categoryName: cat.name,
          tag: cat.tag as string | null,
          overspend: (e.actual ?? 0) - (e.budget ?? 0),
        };
      })
      .filter(Boolean) as {
        id: string; categoryId: string; entryMonth: string;
        budget: number | null; actual: number | null; notes: string | null;
        categoryName: string; tag: string | null; overspend: number;
        createdAt: Date;
      }[];

    const incomeRows = entries
      .map((e) => {
        const cat = categoryMap.get(e.categoryId);
        if (!cat || cat.type !== 'income') return null;
        return { ...e, categoryName: cat.name };
      })
      .filter(Boolean) as {
        id: string; categoryId: string; entryMonth: string;
        budget: number | null; actual: number | null; notes: string | null;
        categoryName: string; createdAt: Date;
      }[];

    // Income from spend entries (salary is now logged as an income spend)
    const incomeFromSpends = spends.filter((s) => s.type === 'income').reduce((s, r) => s + r.amount, 0);
    // Fallback: also include legacy salary/otherIncome if no income spends exist
    const legacySalary = income?.salary ?? 0;
    const legacyOtherIncome = income?.otherIncome ?? 0;
    const legacyIncome = legacySalary + legacyOtherIncome;
    const totalIncome = incomeFromSpends > 0 ? incomeFromSpends : legacyIncome;

    const totalNeed = expenseRows.filter((r) => r.tag === 'need').reduce((s, r) => s + (r.actual ?? 0), 0);
    const totalLuxury = expenseRows.filter((r) => r.tag === 'luxury').reduce((s, r) => s + (r.actual ?? 0), 0);
    const totalExpenses = totalNeed + totalLuxury;
    const totalBudget = expenseRows.reduce((s, r) => s + (r.budget ?? 0), 0);
    const totalOverspend = totalExpenses - totalBudget;

    const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

    const netSavings = totalIncome - totalExpenses - totalInvested;

    // Payment method breakdown from spends
    const pmMap = new Map<string, { name: string; type: string; total: number }>();
    for (const s of spends) {
      if (s.type !== 'expense') continue;
      const existing = pmMap.get(s.paymentMethodId) ?? { name: s.paymentMethodName, type: '', total: 0 };
      existing.total += s.amount;
      const pm = paymentMethods.find((p) => p.id === s.paymentMethodId);
      if (pm) existing.type = pm.type;
      pmMap.set(s.paymentMethodId, existing);
    }
    const paymentMethodBreakdown = Array.from(pmMap, ([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);

    const cycleDay = await getCycleStartDay(userId);
    const { start: cycleStart, end: cycleEnd } = getCycleDateRange(month, cycleDay);
    const remainingForInvestment = totalIncome - totalExpenses;

    // Auto-carry opening balance from previous month's closing if not explicitly set
    let openingBalance = income?.openingBalance ?? null;
    const openingBalanceExplicit = openingBalance !== null;
    if (openingBalance === null) {
      const prevClosing = await this._getPreviousClosingBalance(userId, month);
      if (prevClosing !== null) openingBalance = prevClosing;
    }
    const bankOutflow = bankInvestments + walletTransfers;
    const savings = openingBalance !== null
      ? openingBalance + totalIncome - totalExpenses - bankOutflow
      : totalIncome - totalExpenses - bankOutflow;
    const closingBalance = openingBalance !== null ? savings : null;

    // CC bill: sum of credit_card payment method expenses
    const ccBillTotal = spends
      .filter((s) => s.type === 'expense' && paymentMethods.find((p) => p.id === s.paymentMethodId)?.type === 'credit_card')
      .reduce((sum, s) => sum + s.amount, 0);
    const cashUpiExpenses = totalExpenses - ccBillTotal;

    return {
      month,
      cycleStartDay: cycleDay,
      cycleStart,
      cycleEnd,
      income: {
        totalIncome,
        incomeEntries: incomeRows,
        incomeSpends: spends.filter((s) => s.type === 'income'),
        openingBalance,
        openingBalanceAutoCarried: !openingBalanceExplicit && openingBalance !== null,
        expenseLimit: income?.expenseLimit ?? null,
        investmentTarget: income?.investmentTarget ?? null,
        savingsTarget: income?.savingsTarget ?? null,
      },
      expenses: expenseRows,
      investments,
      spends,
      paymentMethodBreakdown,
      waterfall: {
        openingBalance,
        totalIncome,
        cashUpiExpenses,
        ccBillTotal,
        totalInvested,
        bankInvestments,
        walletTransfers,
        closingBalance,
        savings,
      },
      totals: {
        totalIncome,
        totalExpenses,
        totalBudget,
        totalOverspend,
        totalNeed,
        totalLuxury,
        totalInvested,
        bankInvestments,
        walletTransfers,
        netSavings,
        remainingForInvestment,
        closingBalance,
        savings,
        investmentPct: totalIncome > 0 ? (totalInvested / totalIncome) * 100 : 0,
        needPct: totalIncome > 0 ? (totalNeed / totalIncome) * 100 : 0,
        luxuryPct: totalIncome > 0 ? (totalLuxury / totalIncome) * 100 : 0,
      },
    };
  },

  // ── Yearly summary ────────────────────────────────────────────

  async getYearlySummary(userId: string, year: string) {
    const months: string[] = [];
    const startYear = parseInt(year, 10);
    for (let m = 4; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2, '0')}`);
    for (let m = 1; m <= 3; m++) months.push(`${startYear + 1}-${String(m).padStart(2, '0')}`);

    const summaries = await Promise.all(months.map((m) => this.getMonthSummary(userId, m)));
    return { year, months: summaries };
  },

  // ── Settings ──────────────────────────────────────────────────

  async getSettings(userId: string): Promise<{ cycleStartDay: number; dob: string | null }> {
    const cycleStartDay = await getCycleStartDay(userId);
    const [dobRow] = await db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.key, 'dob'), eq(schema.appSettings.userId, userId)));
    return { cycleStartDay, dob: dobRow?.value ?? null };
  },

  async updateSettings(
    userId: string,
    data: { cycleStartDay?: number; dob?: string },
  ): Promise<{ cycleStartDay: number; dob: string | null }> {
    if (data.cycleStartDay != null) {
      const clamped = Math.max(1, Math.min(28, Math.round(data.cycleStartDay)));
      await db
        .insert(schema.appSettings)
        .values({ key: 'cycleStartDay', userId, value: String(clamped) })
        .onConflictDoUpdate({
          target: [schema.appSettings.key, schema.appSettings.userId],
          set: { value: String(clamped) },
        });
      await this._rebucketAllSpends(userId, clamped);
    }
    if (data.dob != null) {
      await db
        .insert(schema.appSettings)
        .values({ key: 'dob', userId, value: data.dob })
        .onConflictDoUpdate({
          target: [schema.appSettings.key, schema.appSettings.userId],
          set: { value: data.dob },
        });
    }
    return this.getSettings(userId);
  },

  async _rebucketAllSpends(userId: string, cycleDay: number): Promise<void> {
    const allSpends = await db
      .select()
      .from(schema.cashFlowSpends)
      .where(eq(schema.cashFlowSpends.userId, userId));
    const affectedPairs = new Set<string>();

    for (const spend of allSpends) {
      affectedPairs.add(`${spend.categoryId}|${spend.entryMonth}`);
      const newMonth = getCycleMonth(spend.spendDate, cycleDay);
      if (newMonth !== spend.entryMonth) {
        await db
          .update(schema.cashFlowSpends)
          .set({ entryMonth: newMonth })
          .where(eq(schema.cashFlowSpends.id, spend.id));
        affectedPairs.add(`${spend.categoryId}|${newMonth}`);
      }
    }

    for (const pair of affectedPairs) {
      const [categoryId, month] = pair.split('|');
      await this._syncCategoryActual(userId, categoryId, month);
    }
  },

  // ── Portfolio Sync ───────────────────────────────────────────────

  async _findPrimaryBankAsset(userId: string): Promise<{ id: string; symbol: string } | null> {
    const cashAssets = await db
      .select({ id: schema.assets.id, symbol: schema.assets.symbol })
      .from(schema.assets)
      .where(and(eq(schema.assets.assetClass, 'cash'), eq(schema.assets.userId, userId)));
    return cashAssets.find((a) => a.symbol.includes('SAVINGS-ACCOUNT')) ?? null;
  },

  async _getLedgerBalance(userId: string, assetId: string): Promise<number> {
    const position = await transactionService.getPositionForAsset(userId, assetId);
    return position?.currentValue ?? 0;
  },

  async _getCashFlowBankBalance(userId: string, month: string): Promise<number | null> {
    const summary = await this.getMonthSummary(userId, month);
    if (summary.waterfall.openingBalance == null) return null;
    const ob = summary.waterfall.openingBalance;
    const bi = summary.waterfall.bankInvestments ?? 0;
    const wt = summary.waterfall.walletTransfers ?? 0;
    return ob + summary.waterfall.totalIncome - bi - wt - summary.waterfall.cashUpiExpenses;
  },

  async syncPreview(userId: string, month: string): Promise<{
    cashFlowBalance: number | null;
    ledgerBalance: number;
    delta: number;
    primaryBankAssetId: string | null;
  }> {
    const bankAsset = await this._findPrimaryBankAsset(userId);
    if (!bankAsset) {
      return { cashFlowBalance: null, ledgerBalance: 0, delta: 0, primaryBankAssetId: null };
    }

    const cashFlowBalance = await this._getCashFlowBankBalance(userId, month);
    const ledgerBalance = await this._getLedgerBalance(userId, bankAsset.id);
    const delta = cashFlowBalance != null ? cashFlowBalance - ledgerBalance : 0;

    return { cashFlowBalance, ledgerBalance, delta, primaryBankAssetId: bankAsset.id };
  },

  async applySyncToPortfolio(userId: string, month: string): Promise<{
    synced: boolean;
    delta: number;
    transactionId?: string;
  }> {
    const preview = await this.syncPreview(userId, month);
    if (!preview.primaryBankAssetId || preview.cashFlowBalance == null) {
      return { synced: false, delta: 0 };
    }

    const delta = preview.delta;
    if (Math.abs(delta) < 0.01) {
      return { synced: true, delta: 0 };
    }

    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const txDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const tx = await transactionService.create(userId, {
      userId,
      assetId: preview.primaryBankAssetId,
      type: delta > 0 ? 'buy' : 'sell',
      quantity: Math.abs(delta),
      price: 1,
      fees: 0,
      transactionDate: txDate,
      notes: `Cash flow sync — ${month}`,
    });

    return { synced: true, delta, transactionId: tx.id };
  },

  async payCcBill(userId: string, month: string, amount?: number): Promise<{
    paid: boolean;
    amount: number;
    transactionId?: string;
  }> {
    const bankAsset = await this._findPrimaryBankAsset(userId);
    if (!bankAsset) {
      throw new Error('No primary savings account found');
    }

    let ccTotal = amount ?? 0;
    if (ccTotal <= 0) {
      const summary = await this.getMonthSummary(userId, month);
      ccTotal = summary.waterfall.ccBillTotal;
    }
    if (ccTotal <= 0) {
      return { paid: false, amount: 0 };
    }

    const today = new Date().toISOString().slice(0, 10);

    const tx = await transactionService.create(userId, {
      userId,
      assetId: bankAsset.id,
      type: 'sell',
      quantity: ccTotal,
      price: 1,
      fees: 0,
      transactionDate: today,
      notes: `CC bill payment — ${month}`,
    });

    return { paid: true, amount: ccTotal, transactionId: tx.id };
  },
};
