import { eq, desc, sql, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { FireSimulation } from '../db/schema.js';
import { todayLocal } from '../lib/date.js';

export interface FireSimulationInput {
  name: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlySaving: number;
  annualSavingsIncrease: number; // 0.22 for 22%
  returnOnInvestment: number;    // 0.125 for 12.5%
  capitalGainTax: number;        // 0.125 for 12.5%
  postRetirementMonthlyExpense: number;
  inflationRate: number;         // 0.09 for 9%
  startYear: number;
}

export interface FireSimulationRow {
  year: number;
  age: number;
  corpusStart: number;
  savings: number;
  returnOnInvestment: number;
  withdrawals: number;
  monthlySaving: number;
  status: 'accumulating' | 'retired' | 'retired_here' | 'dead' | 'out_of_funds';
}

export interface FireSimulationResult {
  simulation: FireSimulation;
  effectiveReturnRate: number;
  rows: FireSimulationRow[];
  fireAge: number;
  corpusAtRetirement: number;
  fundsLastUntilAge: number;
  /**
   * The earliest age at which retirement is feasible — i.e. the lowest age ≤
   * the planned `retirementAge` for which retiring would still let funds last
   * through `lifeExpectancy`. Equals `retirementAge` when no earlier age is
   * feasible. Used to surface "you could retire X years earlier" insights.
   */
  earliestRetirementAge: number;
}

interface RawSimulationOutput {
  rows: FireSimulationRow[];
  effectiveReturn: number;
  corpusAtRetirement: number;
  fundsLastUntilAge: number;
}

function simulateCore(sim: FireSimulation): RawSimulationOutput {
  const effectiveReturn = sim.returnOnInvestment * (1 - sim.capitalGainTax);
  const rows: FireSimulationRow[] = [];

  let corpus = sim.currentSavings;
  const yearsToSimulate = sim.lifeExpectancy - sim.currentAge + 5;
  let corpusAtRetirement = 0;
  let fundsLastUntilAge = sim.lifeExpectancy;

  for (let i = 0; i <= yearsToSimulate; i++) {
    const year = sim.startYear + i;
    const age = sim.currentAge + i;
    const corpusStart = corpus;

    const isPreRetirement = age < sim.retirementAge;
    const isRetirementYear = age === sim.retirementAge;
    const isPostRetirement = age > sim.retirementAge;
    const isDead = age > sim.lifeExpectancy;

    let yearlySavings = 0;
    let currentMonthlySaving = 0;
    if (isPreRetirement || isRetirementYear) {
      currentMonthlySaving = sim.monthlySaving * Math.pow(1 + sim.annualSavingsIncrease, i);
      yearlySavings = currentMonthlySaving * 12;
    }

    // Year 1 uses pre-tax ROI, subsequent years use post-tax (matches Excel)
    const rate = i === 0 ? sim.returnOnInvestment : effectiveReturn;
    const returnAmt = corpusStart > 0 ? corpusStart * rate : 0;

    let withdrawals = 0;
    if (isRetirementYear || isPostRetirement) {
      const yearsInRetirement = age - sim.retirementAge;
      const expense = sim.postRetirementMonthlyExpense * 12 * Math.pow(1 + sim.inflationRate, yearsInRetirement);
      // Selling investments to fund expenses incurs capital gains tax
      withdrawals = expense * (1 + sim.capitalGainTax);
    }

    let status: FireSimulationRow['status'] = 'accumulating';
    if (isRetirementYear) {
      status = 'retired_here';
      corpusAtRetirement = corpusStart + yearlySavings + returnAmt - withdrawals;
    } else if (isDead) {
      status = corpusStart < 0 ? 'out_of_funds' : 'dead';
    } else if (isPostRetirement) {
      status = 'retired';
    }

    if (corpusStart > 0 && corpusStart + returnAmt - withdrawals < 0 && fundsLastUntilAge === sim.lifeExpectancy) {
      fundsLastUntilAge = age;
    }

    rows.push({
      year,
      age,
      corpusStart: Math.round(corpusStart),
      savings: Math.round(yearlySavings),
      returnOnInvestment: Math.round(returnAmt),
      withdrawals: Math.round(withdrawals),
      monthlySaving: Math.round(currentMonthlySaving),
      status,
    });

    corpus = corpusStart + yearlySavings + returnAmt - withdrawals;

    if (isDead && corpusStart < 0) {
      if (i > yearsToSimulate - 3) break;
    }
  }

  if (corpusAtRetirement === 0 && rows.length > 0) {
    const retRow = rows.find((r) => r.status === 'retired_here');
    if (retRow) corpusAtRetirement = retRow.corpusStart;
  }

  return { rows, effectiveReturn, corpusAtRetirement, fundsLastUntilAge };
}

/**
 * Find the earliest age between `currentAge + 1` and the planned
 * `retirementAge` at which retiring would still let funds last through
 * `lifeExpectancy`. Returns the planned `retirementAge` if no earlier age is
 * feasible. Implementation: re-simulates with each candidate retirement age
 * and picks the lowest one whose `fundsLastUntilAge >= lifeExpectancy`.
 *
 * Cost: O(N × M) where N = retirementAge − currentAge (typically ≤ 30) and
 * M = full simulation length (~60 years). At ~3 scenarios this is a few
 * thousand cheap arithmetic ops per request.
 */
function findEarliestRetirementAge(sim: FireSimulation): number {
  const planned = sim.retirementAge;
  if (planned <= sim.currentAge + 1) return planned;
  for (let candidate = sim.currentAge + 1; candidate < planned; candidate++) {
    const result = simulateCore({ ...sim, retirementAge: candidate });
    if (
      result.fundsLastUntilAge >= sim.lifeExpectancy &&
      result.corpusAtRetirement > 0
    ) {
      return candidate;
    }
  }
  return planned;
}

function runSimulation(sim: FireSimulation): Omit<FireSimulationResult, 'simulation'> {
  const core = simulateCore(sim);
  return {
    effectiveReturnRate: core.effectiveReturn,
    rows: core.rows,
    fireAge: sim.retirementAge,
    corpusAtRetirement: Math.round(core.corpusAtRetirement),
    fundsLastUntilAge: core.fundsLastUntilAge,
    earliestRetirementAge: findEarliestRetirementAge(sim),
  };
}

/** Reserved scenario names that cannot be renamed by the user. The cash-flow
 *  page and other surfaces rely on these names existing as a stable identity
 *  for the primary/Lean/Fat scenarios.
 */
const RESERVED_SCENARIO_NAMES: ReadonlySet<string> = new Set([
  'Base FIRE',
  'Lean FIRE',
  'Fat FIRE',
]);

const REFERENCE_SCENARIOS: FireSimulationInput[] = [
  {
    name: 'Base FIRE',
    currentAge: 27, retirementAge: 36, lifeExpectancy: 85,
    currentSavings: 3076000, monthlySaving: 117500,
    annualSavingsIncrease: 0.22,
    returnOnInvestment: 0.125, capitalGainTax: 0.125,
    postRetirementMonthlyExpense: 145000,
    inflationRate: 0.09, startYear: 2025,
  },
  {
    name: 'Lean FIRE',
    currentAge: 27, retirementAge: 38, lifeExpectancy: 85,
    currentSavings: 3076000, monthlySaving: 117500,
    annualSavingsIncrease: 0.25,
    returnOnInvestment: 0.135, capitalGainTax: 0.125,
    postRetirementMonthlyExpense: 300000,
    inflationRate: 0.09, startYear: 2025,
  },
  {
    name: 'Fat FIRE',
    currentAge: 27, retirementAge: 41, lifeExpectancy: 85,
    currentSavings: 3076000, monthlySaving: 117500,
    annualSavingsIncrease: 0.27,
    returnOnInvestment: 0.145, capitalGainTax: 0.125,
    postRetirementMonthlyExpense: 900000,
    inflationRate: 0.09, startYear: 2025,
  },
];

export const fireService = {
  async getAll(userId: string): Promise<FireSimulation[]> {
    const SORT_ORDER: Record<string, number> = { 'Base FIRE': 0, 'Lean FIRE': 1, 'Fat FIRE': 2 };
    const all = await db
      .select()
      .from(schema.fireSimulations)
      .where(eq(schema.fireSimulations.userId, userId));
    return all.sort((a, b) => (SORT_ORDER[a.name] ?? 99) - (SORT_ORDER[b.name] ?? 99));
  },

  async getById(userId: string, id: string): Promise<FireSimulation | null> {
    return db
      .select()
      .from(schema.fireSimulations)
      .where(and(eq(schema.fireSimulations.id, id), eq(schema.fireSimulations.userId, userId)))
      .limit(1)
      .then((r) => r[0] ?? null);
  },

  async create(userId: string, input: FireSimulationInput): Promise<FireSimulation> {
    const id = nanoid();
    await db.insert(schema.fireSimulations).values({
      id,
      userId,
      ...input,
      isActive: true,
      createdAt: new Date(),
    });
    return (await this.getById(userId, id))!;
  },

  async update(
    userId: string,
    id: string,
    input: Partial<FireSimulationInput> & { isActive?: boolean },
  ): Promise<FireSimulation | null> {
    const existing = await this.getById(userId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) updates[key] = value;
    }

    // Reserved scenarios (Base/Lean/Fat FIRE) keep their names locked so that
    // the cash-flow integration and other surfaces can reliably address them.
    // Same-name updates from auto-seed pass through silently; only renames are
    // blocked. We just strip the field so the rest of the update still applies.
    if (
      RESERVED_SCENARIO_NAMES.has(existing.name) &&
      typeof updates.name === 'string' &&
      updates.name !== existing.name
    ) {
      delete updates.name;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.fireSimulations)
        .set(updates as any)
        .where(and(eq(schema.fireSimulations.id, id), eq(schema.fireSimulations.userId, userId)));
    }
    return this.getById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    await db
      .delete(schema.fireSimulations)
      .where(and(eq(schema.fireSimulations.id, id), eq(schema.fireSimulations.userId, userId)));
    return true;
  },

  async getSimulationResult(userId: string, id: string): Promise<FireSimulationResult | null> {
    const sim = await this.getById(userId, id);
    if (!sim) return null;
    return { simulation: sim, ...runSimulation(sim) };
  },

  computeFromInputs(
    userId: string,
    input: FireSimulationInput & { id?: string },
  ): Omit<FireSimulationResult, 'simulation'> & { simulation: FireSimulationInput } {
    const sim = {
      id: input.id ?? 'preview',
      ...input,
      isActive: true,
      createdAt: new Date(),
    } as FireSimulation;
    return { simulation: input as any, ...runSimulation(sim) };
  },

  // ── Reference FIRE scenarios from Excel baseline ────────────────

  async autoSeedScenarios(userId: string): Promise<{ created: number; updated: number }> {
    const existing = await this.getAll(userId);

    let created = 0;
    let updated = 0;

    for (const scen of REFERENCE_SCENARIOS) {
      const match = existing.find((s) => s.name === scen.name);
      if (match) {
        // Full upsert — reset all params to Excel reference values
        await this.update(userId, match.id, { ...scen });
        updated++;
      } else {
        await this.create(userId, scen);
        created++;
      }
    }
    return { created, updated };
  },

  // Sync only currentSavings from live portfolio (Base/Lean/Fat)
  async syncPortfolio(userId: string): Promise<{ synced: number; liveValue: number }> {
    const existing = await this.getAll(userId);
    const portfolioValue = await this._getCurrentPortfolioValue(userId);
    const SYNCED = new Set(['Base FIRE', 'Lean FIRE', 'Fat FIRE']);
    let synced = 0;

    const [dobRow] = await db
      .select()
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.key, 'dob'), eq(schema.appSettings.userId, userId)));
    const dobStr = dobRow?.value ?? '1998-09-09';
    const today = todayLocal();
    const currentYear = Number(today.split('-')[0]);
    const birthYear = Number(dobStr.split('-')[0]);
    const birthMonth = Number(dobStr.split('-')[1]);
    const birthDay = Number(dobStr.split('-')[2]);
    const todayMonth = Number(today.split('-')[1]);
    const todayDay = Number(today.split('-')[2]);
    const age = currentYear - birthYear - (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay) ? 1 : 0);

    for (const sim of existing) {
      if (SYNCED.has(sim.name) && portfolioValue > 0) {
        await this.update(userId, sim.id, {
          currentSavings: portfolioValue,
          currentAge: age,
          startYear: currentYear,
        });
        synced++;
      }
    }
    return { synced, liveValue: Math.round(portfolioValue) };
  },

  async _getCurrentPortfolioValue(userId: string): Promise<number> {
    // Try live snapshot first, fall back to latest portfolio_snapshot
    const snapshots = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.userId, userId))
      .orderBy(desc(schema.portfolioSnapshots.snapshotDate))
      .limit(1);
    return snapshots[0]?.totalValue ?? 0;
  },

  async _getAvgMonthlySaving(userId: string): Promise<number> {
    // Average monthly buy-side investment over all transactions
    const rows = await db
      .select({
        month: sql<string>`substr(${schema.transactions.transactionDate}, 1, 7)`,
        total: sql<number>`sum(${schema.transactions.quantity} * ${schema.transactions.price})`,
      })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(and(eq(schema.transactions.type, 'buy'), eq(schema.assets.userId, userId)))
      .groupBy(sql`substr(${schema.transactions.transactionDate}, 1, 7)`);
    if (rows.length === 0) return 117500; // fallback
    const sum = rows.reduce((s, r) => s + (r.total ?? 0), 0);
    return Math.round(sum / rows.length);
  },

  // ── Portfolio history from transactions ────────────────────────

  async _getPortfolioHistory(userId: string): Promise<{ year: number; value: number }[]> {
    // 1. Actual snapshots (most accurate)
    const snapshots = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.userId, userId));
    const snapshotYearMap = new Map<number, { value: number; date: string }>();
    for (const s of snapshots) {
      const year = parseInt(s.snapshotDate.slice(0, 4), 10);
      if (!snapshotYearMap.has(year) || s.snapshotDate > snapshotYearMap.get(year)!.date) {
        snapshotYearMap.set(year, { value: s.totalValue, date: s.snapshotDate });
      }
    }

    // 2. Derive from cumulative cost basis for years without snapshots
    const txRows = await db
      .select({
        year: sql<number>`cast(substr(${schema.transactions.transactionDate}, 1, 4) as integer)`,
        type: schema.transactions.type,
        total: sql<number>`sum(${schema.transactions.quantity} * ${schema.transactions.price})`,
      })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId))
      .groupBy(
        sql`substr(${schema.transactions.transactionDate}, 1, 4)`,
        schema.transactions.type,
      );
    // Build cumulative invested by year
    const yearlyNet = new Map<number, number>();
    for (const row of txRows) {
      const existing = yearlyNet.get(row.year) ?? 0;
      yearlyNet.set(row.year, existing + (row.type === 'buy' ? row.total : -row.total));
    }

    const allYears = new Set([...snapshotYearMap.keys(), ...yearlyNet.keys()]);
    const sortedYears = [...allYears].sort((a, b) => a - b);

    const result: { year: number; value: number }[] = [];
    let cumulative = 0;

    for (const year of sortedYears) {
      cumulative += yearlyNet.get(year) ?? 0;
      // Prefer snapshot if available, otherwise use cumulative cost basis
      const value = snapshotYearMap.has(year)
        ? snapshotYearMap.get(year)!.value
        : cumulative;
      result.push({ year, value: Math.round(value) });
    }

    return result;
  },

  async getMonthlyTargets(userId: string, fy?: number): Promise<{
    fy: number;
    fyLabel: string;
    scenarios: { id: string; name: string; monthlySaving: number }[];
    months: {
      month: string;
      label: string;
      targets: Record<string, number>;
      investmentTargets: Record<string, number>;
      actual: number | null;
      income: number | null;
      actualInvestment: number;
    }[];
  }> {
    const now = new Date();
    const curMonth = now.getMonth(); // 0=Jan
    const fyYear = fy ?? (curMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1);

    // Build 12 month keys: Apr YYYY .. Mar YYYY+1
    const monthKeys: string[] = [];
    const monthLabels: string[] = [];
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 12; i++) {
      const m = (3 + i) % 12; // 3=Apr..11=Dec, 0=Jan..2=Mar
      const y = m >= 3 ? fyYear : fyYear + 1;
      monthKeys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
      monthLabels.push(`${MONTH_NAMES[m]} '${String(y).slice(2)}`);
    }

    // Run simulations
    const all = await this.getAll(userId);
    const simResults = all.map((sim) => ({
      id: sim.id,
      name: sim.name,
      ...runSimulation(sim),
    }));

    // Interpolate monthly corpus targets + extract monthlySaving per scenario
    const scenarioTargets: { id: string; name: string; monthly: number[]; monthlySaving: number }[] = [];
    for (const sim of simResults) {
      const row = sim.rows.find((r) => r.year === fyYear);
      if (!row) {
        scenarioTargets.push({ id: sim.id, name: sim.name, monthly: Array(12).fill(0), monthlySaving: 0 });
        continue;
      }
      const nextRow = sim.rows.find((r) => r.year === fyYear + 1);
      const startCorpus = row.corpusStart;
      const endCorpus = nextRow
        ? nextRow.corpusStart
        : startCorpus + row.savings + row.returnOnInvestment - row.withdrawals;
      const monthly: number[] = [];
      for (let i = 0; i < 12; i++) {
        monthly.push(Math.round(startCorpus + (endCorpus - startCorpus) * (i + 1) / 12));
      }
      scenarioTargets.push({ id: sim.id, name: sim.name, monthly, monthlySaving: row.monthlySaving });
    }

    // Actual portfolio values by month from snapshots
    const snapshots = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.userId, userId));
    const monthSnap = new Map<string, { value: number; date: string }>();
    for (const s of snapshots) {
      const key = s.snapshotDate.slice(0, 7);
      const existing = monthSnap.get(key);
      if (!existing || s.snapshotDate > existing.date) {
        monthSnap.set(key, { value: s.totalValue, date: s.snapshotDate });
      }
    }

    // Monthly income & expense totals from cash flow spends
    const spendRows = await db
      .select({
        month: schema.cashFlowSpends.entryMonth,
        type: schema.cashFlowSpends.type,
        total: sql<number>`sum(${schema.cashFlowSpends.amount})`,
      })
      .from(schema.cashFlowSpends)
      .where(eq(schema.cashFlowSpends.userId, userId))
      .groupBy(schema.cashFlowSpends.entryMonth, schema.cashFlowSpends.type);
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const row of spendRows) {
      const val = Math.round(row.total ?? 0);
      if (row.type === 'income') {
        incomeMap.set(row.month, (incomeMap.get(row.month) ?? 0) + val);
      } else if (row.type === 'expense') {
        expenseMap.set(row.month, (expenseMap.get(row.month) ?? 0) + val);
      }
      // 'transfer' rows are balance-sheet movements (e.g. salary
      // sweep into another bank account, money returned from a
      // wallet). They are neither income nor expense and must not
      // bias the "what did I save this month" calculation. Falling
      // through here intentionally drops them.
    }

    const months = monthKeys.map((key, i) => {
      const income = incomeMap.get(key) ?? null;
      const expenses = expenseMap.get(key) ?? 0;
      // Investment = Income − Expenses (everything not spent is saved/invested)
      const actualInvestment = income != null ? Math.max(0, income - expenses) : 0;

      return {
        month: key,
        label: monthLabels[i],
        targets: Object.fromEntries(scenarioTargets.map((st) => [st.id, st.monthly[i]])),
        investmentTargets: Object.fromEntries(scenarioTargets.map((st) => [st.id, st.monthlySaving])),
        actual: monthSnap.has(key) ? Math.round(monthSnap.get(key)!.value) : null,
        income,
        actualInvestment,
      };
    });

    return {
      fy: fyYear,
      fyLabel: `FY ${fyYear}-${String(fyYear + 1).slice(2)}`,
      scenarios: scenarioTargets.map((st) => ({ id: st.id, name: st.name, monthlySaving: st.monthlySaving })),
      months,
    };
  },

  async getAllProjections(userId: string): Promise<{
    simulations: (FireSimulationResult & { id: string; name: string })[];
    actualPortfolio: { year: number; value: number }[];
    liveValue: number;
    liveProgress: { id: string; name: string; projected: number; actual: number; deficit: number }[];
  }> {
    const all = await this.getAll(userId);
    const simulations = all.map((sim) => ({
      id: sim.id,
      name: sim.name,
      simulation: sim,
      ...runSimulation(sim),
    }));

    // Get enriched portfolio history (snapshots + transaction-derived)
    const actualPortfolio = await this._getPortfolioHistory(userId);

    // Live portfolio value for current year progress
    const liveValue = await this._getCurrentPortfolioValue(userId);
    const currentYear = new Date().getFullYear();

    // Compare actual portfolio against the projected corpus at the START of the current year
    const liveProgress = simulations.map((sim) => {
      const row = sim.rows.find((r) => r.year === currentYear);
      const projected = row ? row.corpusStart : 0;
      return {
        id: sim.id,
        name: sim.name,
        projected: Math.round(projected),
        actual: Math.round(liveValue),
        deficit: Math.round(projected - liveValue),
      };
    });

    return { simulations, actualPortfolio, liveValue: Math.round(liveValue), liveProgress };
  },

  /**
   * What-if: model a **single month** of saving more (or less) than the FIRE
   * plan baseline and report the impact on each scenario. The user input is
   * "what if I save ₹X this month?" — a one-time delta, not a permanent
   * change to monthly saving.
   *
   * The delta is added to (or removed from) the corpus at the start of the
   * current FY and grown forward to the planned retirement age at the
   * scenario's effective (post-tax) return rate. The adjusted simulation is
   * then re-run with the corpus offset to detect whether the extra/less
   * saving brings retirement forward (or pushes it back) via the early-
   * retirement check.
   */
  async whatIf(userId: string, adjustedMonthlySaving: number): Promise<{
    scenarios: {
      id: string;
      name: string;
      original: {
        retirementAge: number;
        corpusAtRetirement: number;
        monthlySaving: number;
        earliestRetirementAge: number;
      };
      adjusted: {
        retirementAge: number;
        corpusAtRetirement: number;
        monthlySaving: number;
        earliestRetirementAge: number;
      };
      delta: {
        retirementAgeShift: number;
        corpusDelta: number;
        savingDelta: number;
      };
    }[];
  }> {
    const all = await this.getAll(userId);
    const currentYear = new Date().getFullYear();

    const scenarios = all.map((sim) => {
      const originalResult = runSimulation(sim);

      // The FIRE plan's baseline monthly saving for the *current* FY (with
      // annualSavingsIncrease compounded) — that's what the user is comparing
      // against when they imagine saving more or less "this month".
      const yearsFromStart = Math.max(0, currentYear - sim.startYear);
      const baselineThisMonth = sim.monthlySaving * Math.pow(1 + sim.annualSavingsIncrease, yearsFromStart);
      const oneMonthDelta = adjustedMonthlySaving - baselineThisMonth;

      // Future-value the one-month delta at the post-tax effective return
      // until the planned retirement year. This is the closed-form impact on
      // the corpus at retirement of changing exactly one month of saving.
      const yearsToRetirement = Math.max(0, sim.retirementAge - sim.currentAge - yearsFromStart);
      const effectiveReturn = sim.returnOnInvestment * (1 - sim.capitalGainTax);
      const corpusDelta = oneMonthDelta * Math.pow(1 + effectiveReturn, yearsToRetirement);

      // For the early-retirement comparison, simulate with the same delta
      // applied as a one-time bump to currentSavings (i.e. carry the extra
      // ₹X straight onto the starting corpus). This lets us compute whether
      // the extra month's saving lets you retire earlier.
      const adjustedSim = { ...sim, currentSavings: sim.currentSavings + oneMonthDelta };
      const adjustedEarliest = findEarliestRetirementAge(adjustedSim);

      const adjustedCorpusAtRetirement = originalResult.corpusAtRetirement + corpusDelta;

      return {
        id: sim.id,
        name: sim.name,
        original: {
          retirementAge: sim.retirementAge,
          corpusAtRetirement: originalResult.corpusAtRetirement,
          monthlySaving: Math.round(baselineThisMonth),
          earliestRetirementAge: originalResult.earliestRetirementAge,
        },
        adjusted: {
          retirementAge: sim.retirementAge,
          corpusAtRetirement: Math.round(adjustedCorpusAtRetirement),
          monthlySaving: Math.round(adjustedMonthlySaving),
          earliestRetirementAge: adjustedEarliest,
        },
        delta: {
          // Positive = retirement pulled earlier; negative = pushed later.
          retirementAgeShift: originalResult.earliestRetirementAge - adjustedEarliest,
          corpusDelta: Math.round(corpusDelta),
          savingDelta: Math.round(oneMonthDelta),
        },
      };
    });

    return { scenarios };
  },

  /**
   * Lightweight helper used by the cash-flow page to derive a savings target
   * from the FIRE plan without running the full `getMonthlyTargets` machinery
   * (which loads every simulation, runs full multi-decade simulations, and
   * aggregates portfolio snapshots and cash-flow spends — all wasted work
   * when we only need a single number).
   *
   * Returns the primary scenario's `monthlySaving` for the requested FY,
   * compounded by `annualSavingsIncrease`, or `null` if no simulation exists
   * / the FY is before the simulation starts / the user is already retired.
   */
  async getCurrentFyInvestmentTarget(userId: string, fy: number): Promise<{
    scenarioId: string;
    scenarioName: string;
    monthlySaving: number;
  } | null> {
    const all = await this.getAll(userId);
    // getAll sorts Base FIRE → Lean FIRE → Fat FIRE → others, so the first
    // entry is the primary scenario when reserved scenarios exist.
    const primary = all[0];
    if (!primary) return null;

    if (fy < primary.startYear) return null;
    const ageInFy = primary.currentAge + (fy - primary.startYear);
    if (ageInFy > primary.retirementAge) return null; // retired by this FY

    const yearsFromStart = fy - primary.startYear;
    const monthlySaving = primary.monthlySaving * Math.pow(1 + primary.annualSavingsIncrease, yearsFromStart);
    if (!Number.isFinite(monthlySaving) || monthlySaving <= 0) return null;

    return {
      scenarioId: primary.id,
      scenarioName: primary.name,
      monthlySaving: Math.round(monthlySaving),
    };
  },
};
