import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { transactionService } from './transaction.service.js';
import { benchmarkService, type BenchmarkPerformance } from './benchmark.service.js';
import type { TimeInterval, AssetClass, PortfolioSnapshot } from '../db/schema.js';

export interface PerformanceMetrics {
  startValue: number;
  endValue: number;
  absoluteReturn: number;
  percentageReturn: number;
  annualizedReturn: number | null; // Only for periods > 1 year
  totalCost: number;
  realizedGains: number;
  unrealizedGains: number;
}

export interface PortfolioPerformance extends PerformanceMetrics {
  interval: TimeInterval;
  startDate: string;
  endDate: string;
  valueHistory: { date: string; value: number }[];
}

export interface PerformanceComparison {
  portfolio: PortfolioPerformance;
  benchmarks: BenchmarkPerformance[];
}

export interface AssetClassPerformance {
  assetClass: AssetClass;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

export interface TagPerformance {
  tagId: string;
  tagName: string;
  tagColor: string;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

// Calculate start date based on interval
function getStartDate(interval: TimeInterval): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  switch (interval) {
    case '1D':
      return new Date(now.setDate(now.getDate() - 1));
    case '1W':
      return new Date(now.setDate(now.getDate() - 7));
    case '1M':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3M':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6M':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1Y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case 'YTD':
      return new Date(now.getFullYear(), 0, 1);
    case 'ALL':
      return new Date(2000, 0, 1);
    default:
      return new Date(now.setMonth(now.getMonth() - 1));
  }
}

// Calculate days between dates
function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate annualized return
function calculateAnnualizedReturn(
  percentageReturn: number,
  days: number
): number | null {
  if (days < 365) return null;
  const years = days / 365;
  return (Math.pow(1 + percentageReturn / 100, 1 / years) - 1) * 100;
}

export const performanceService = {
  // Get portfolio performance for a given interval
  async getPortfolioPerformance(interval: TimeInterval): Promise<PortfolioPerformance> {
    const startDate = getStartDate(interval);
    const endDate = new Date();
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get current portfolio value
    const positions = await transactionService.getAllPositions();
    const currentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const currentCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
    const unrealizedGains = positions.reduce((sum, p) => sum + p.unrealizedGain, 0);
    const realizedGains = await transactionService.getTotalRealizedGains();

    // Get historical snapshots for the period
    const snapshots = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(gte(schema.portfolioSnapshots.snapshotDate, startDateStr))
      .orderBy(asc(schema.portfolioSnapshots.snapshotDate))
      .all();

    // Build value history
    const valueHistory: { date: string; value: number }[] = snapshots.map((s) => ({
      date: s.snapshotDate,
      value: s.totalValue,
    }));

    // Add current value if not already in snapshots
    if (valueHistory.length === 0 || valueHistory[valueHistory.length - 1].date !== endDateStr) {
      valueHistory.push({ date: endDateStr, value: currentValue });
    }

    // Get start value (from snapshot or estimate from transactions)
    let startValue = snapshots.length > 0 ? snapshots[0].totalValue : 0;
    
    // If no snapshots, estimate from transactions before start date
    if (startValue === 0) {
      startValue = await this.estimatePortfolioValueAtDate(startDateStr);
    }

    // Calculate returns
    const absoluteReturn = currentValue - startValue;
    const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;
    const days = daysBetween(startDate, endDate);
    const annualizedReturn = calculateAnnualizedReturn(percentageReturn, days);

    return {
      interval,
      startDate: startDateStr,
      endDate: endDateStr,
      startValue,
      endValue: currentValue,
      absoluteReturn,
      percentageReturn,
      annualizedReturn,
      totalCost: currentCost,
      realizedGains,
      unrealizedGains,
      valueHistory,
    };
  },

  // Estimate portfolio value at a specific date
  async estimatePortfolioValueAtDate(dateStr: string): Promise<number> {
    // Get all transactions up to this date
    const transactions = await db
      .select()
      .from(schema.transactions)
      .where(lte(schema.transactions.transactionDate, dateStr))
      .orderBy(asc(schema.transactions.transactionDate))
      .all();

    // Calculate positions at that date
    const positions = new Map<string, { quantity: number; cost: number }>();

    for (const tx of transactions) {
      const current = positions.get(tx.assetId) || { quantity: 0, cost: 0 };
      if (tx.type === 'buy') {
        current.quantity += tx.quantity;
        current.cost += tx.quantity * tx.price;
      } else {
        current.quantity -= tx.quantity;
        // Approximate cost reduction
        const avgCost = current.quantity > 0 ? current.cost / (current.quantity + tx.quantity) : 0;
        current.cost -= tx.quantity * avgCost;
      }
      positions.set(tx.assetId, current);
    }

    // Get prices at that date (or closest available)
    let totalValue = 0;
    for (const [assetId, position] of positions) {
      if (position.quantity <= 0) continue;

      const priceRecord = await db
        .select()
        .from(schema.priceHistory)
        .where(
          and(
            eq(schema.priceHistory.assetId, assetId),
            lte(sql`date(${schema.priceHistory.recordedAt} / 1000, 'unixepoch')`, dateStr)
          )
        )
        .orderBy(desc(schema.priceHistory.recordedAt))
        .limit(1)
        .then((r) => r[0]);

      const price = priceRecord?.price || 0;
      totalValue += position.quantity * price;
    }

    // If no price history, use cost as approximation
    if (totalValue === 0) {
      for (const [, position] of positions) {
        if (position.quantity > 0) {
          totalValue += position.cost;
        }
      }
    }

    return totalValue;
  },

  // Compare portfolio performance with benchmarks
  async compareWithBenchmarks(
    interval: TimeInterval,
    benchmarkSymbols: string[]
  ): Promise<PerformanceComparison> {
    const portfolio = await this.getPortfolioPerformance(interval);
    const benchmarks = await benchmarkService.getMultiplePerformance(
      benchmarkSymbols,
      interval
    );

    return { portfolio, benchmarks };
  },

  // Get performance by asset class
  async getPerformanceByAssetClass(
    interval: TimeInterval
  ): Promise<AssetClassPerformance[]> {
    const positions = await transactionService.getAllPositions();
    const startDate = getStartDate(interval);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Group positions by asset class
    const byClass = new Map<
      AssetClass,
      { positions: typeof positions; currentValue: number; totalCost: number }
    >();

    for (const position of positions) {
      const assetClass = position.assetClass as AssetClass;
      const existing = byClass.get(assetClass) || {
        positions: [],
        currentValue: 0,
        totalCost: 0,
      };
      existing.positions.push(position);
      existing.currentValue += position.currentValue;
      existing.totalCost += position.totalCost;
      byClass.set(assetClass, existing);
    }

    const results: AssetClassPerformance[] = [];

    for (const [assetClass, data] of byClass) {
      // Estimate start value for this asset class
      let startValue = 0;
      for (const position of data.positions) {
        const historicalValue = await this.estimateAssetValueAtDate(
          position.assetId,
          startDateStr
        );
        startValue += historicalValue;
      }

      const endValue = data.currentValue;
      const absoluteReturn = endValue - startValue;
      const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;
      const days = daysBetween(startDate, new Date());

      // Calculate realized gains for this asset class
      let realizedGains = 0;
      for (const position of data.positions) {
        realizedGains += position.realizedGain;
      }

      results.push({
        assetClass,
        performance: {
          startValue,
          endValue,
          absoluteReturn,
          percentageReturn,
          annualizedReturn: calculateAnnualizedReturn(percentageReturn, days),
          totalCost: data.totalCost,
          realizedGains,
          unrealizedGains: data.positions.reduce((sum, p) => sum + p.unrealizedGain, 0),
        },
        holdings: data.positions.length,
        currentValue: data.currentValue,
      });
    }

    return results.sort((a, b) => b.currentValue - a.currentValue);
  },

  // Estimate single asset value at a date
  async estimateAssetValueAtDate(assetId: string, dateStr: string): Promise<number> {
    // Get transactions up to date
    const transactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          lte(schema.transactions.transactionDate, dateStr)
        )
      )
      .all();

    let quantity = 0;
    for (const tx of transactions) {
      if (tx.type === 'buy') {
        quantity += tx.quantity;
      } else {
        quantity -= tx.quantity;
      }
    }

    if (quantity <= 0) return 0;

    // Get price at that date
    const priceRecord = await db
      .select()
      .from(schema.priceHistory)
      .where(
        and(
          eq(schema.priceHistory.assetId, assetId),
          lte(sql`date(${schema.priceHistory.recordedAt} / 1000, 'unixepoch')`, dateStr)
        )
      )
      .orderBy(desc(schema.priceHistory.recordedAt))
      .limit(1)
      .then((r) => r[0]);

    return quantity * (priceRecord?.price || 0);
  },

  // Get performance by tag
  async getPerformanceByTag(
    tagId: string,
    interval: TimeInterval
  ): Promise<TagPerformance | null> {
    const tag = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.id, tagId))
      .limit(1)
      .then((r) => r[0]);

    if (!tag) return null;

    // Get assets with this tag
    const taggedAssets = await db
      .select({ assetId: schema.assetTags.assetId })
      .from(schema.assetTags)
      .where(eq(schema.assetTags.tagId, tagId))
      .all();

    const assetIds = new Set(taggedAssets.map((t) => t.assetId));
    if (assetIds.size === 0) {
      return {
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
        performance: {
          startValue: 0,
          endValue: 0,
          absoluteReturn: 0,
          percentageReturn: 0,
          annualizedReturn: null,
          totalCost: 0,
          realizedGains: 0,
          unrealizedGains: 0,
        },
        holdings: 0,
        currentValue: 0,
      };
    }

    // Get positions for tagged assets
    const allPositions = await transactionService.getAllPositions();
    const positions = allPositions.filter((p) => assetIds.has(p.assetId));

    const startDate = getStartDate(interval);
    const startDateStr = startDate.toISOString().split('T')[0];

    let startValue = 0;
    let endValue = 0;
    let totalCost = 0;
    let realizedGains = 0;
    let unrealizedGains = 0;

    for (const position of positions) {
      startValue += await this.estimateAssetValueAtDate(position.assetId, startDateStr);
      endValue += position.currentValue;
      totalCost += position.totalCost;
      realizedGains += position.realizedGain;
      unrealizedGains += position.unrealizedGain;
    }

    const absoluteReturn = endValue - startValue;
    const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;
    const days = daysBetween(startDate, new Date());

    return {
      tagId: tag.id,
      tagName: tag.name,
      tagColor: tag.color,
      performance: {
        startValue,
        endValue,
        absoluteReturn,
        percentageReturn,
        annualizedReturn: calculateAnnualizedReturn(percentageReturn, days),
        totalCost,
        realizedGains,
        unrealizedGains,
      },
      holdings: positions.length,
      currentValue: endValue,
    };
  },

  // Take a daily snapshot of portfolio value
  async takeSnapshot(): Promise<PortfolioSnapshot | null> {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have a snapshot for today
    const existing = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(eq(schema.portfolioSnapshots.snapshotDate, today))
      .limit(1);

    if (existing.length > 0) {
      // Update existing snapshot
      const positions = await transactionService.getAllPositions();
      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
      const realizedGains = await transactionService.getTotalRealizedGains();

      // Build allocation breakdown
      const allocationByClass: Record<string, number> = {};
      for (const position of positions) {
        allocationByClass[position.assetClass] =
          (allocationByClass[position.assetClass] || 0) + position.currentValue;
      }

      await db
        .update(schema.portfolioSnapshots)
        .set({
          totalValue,
          totalCost,
          realizedGains,
          allocationBreakdown: JSON.stringify(allocationByClass),
        })
        .where(eq(schema.portfolioSnapshots.id, existing[0].id));

      return { ...existing[0], totalValue, totalCost };
    }

    // Create new snapshot
    const positions = await transactionService.getAllPositions();
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
    const realizedGains = await transactionService.getTotalRealizedGains();

    const allocationByClass: Record<string, number> = {};
    for (const position of positions) {
      allocationByClass[position.assetClass] =
        (allocationByClass[position.assetClass] || 0) + position.currentValue;
    }

    const snapshot = {
      id: nanoid(),
      snapshotDate: today,
      totalValue,
      totalCost,
      realizedGains,
      allocationBreakdown: JSON.stringify(allocationByClass),
      createdAt: new Date(),
    };

    await db.insert(schema.portfolioSnapshots).values(snapshot);
    return snapshot as PortfolioSnapshot;
  },

  // Get all snapshots for charting
  async getSnapshots(interval: TimeInterval): Promise<PortfolioSnapshot[]> {
    const startDate = getStartDate(interval);
    const startDateStr = startDate.toISOString().split('T')[0];

    return db
      .select()
      .from(schema.portfolioSnapshots)
      .where(gte(schema.portfolioSnapshots.snapshotDate, startDateStr))
      .orderBy(asc(schema.portfolioSnapshots.snapshotDate))
      .all();
  },
};
