import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { yahooFinanceProvider } from '../providers/yahoo-finance.provider.js';
import type { Benchmark, BenchmarkPrice, TimeInterval } from '../db/schema.js';
import { todayLocal, dateToLocal } from '../lib/date.js';

export interface BenchmarkWithLatestPrice extends Benchmark {
  latestPrice: number | null;
  latestDate: string | null;
}

export interface BenchmarkPerformance {
  symbol: string;
  name: string;
  region: string;
  startPrice: number;
  endPrice: number;
  change: number;
  changePercent: number;
  priceHistory: { date: string; price: number }[];
}

// Calculate start date based on interval
function getStartDate(interval: TimeInterval, overrideStartStr?: string): Date {
  if (overrideStartStr) {
    return new Date(overrideStartStr);
  }
  const now = new Date();
  switch (interval) {
    case '1D':
      return new Date(now.setDate(now.getDate() - 1));
    case '5D':
      return new Date(now.setDate(now.getDate() - 5));
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
    case 'CUSTOM':
      return new Date(2000, 0, 1);
    default:
      return new Date(now.setMonth(now.getMonth() - 1));
  }
}

export const benchmarkService = {
  async getAll(): Promise<Benchmark[]> {
    return db.select().from(schema.benchmarks);
  },

  async getActive(): Promise<Benchmark[]> {
    return db
      .select()
      .from(schema.benchmarks)
      .where(eq(schema.benchmarks.isActive, true));
  },

  async getById(id: string): Promise<Benchmark | undefined> {
    const results = await db
      .select()
      .from(schema.benchmarks)
      .where(eq(schema.benchmarks.id, id))
      .limit(1);
    return results[0];
  },

  async getBySymbol(symbol: string): Promise<Benchmark | undefined> {
    const results = await db
      .select()
      .from(schema.benchmarks)
      .where(eq(schema.benchmarks.symbol, symbol))
      .limit(1);
    return results[0];
  },

  async getAllWithLatestPrices(): Promise<BenchmarkWithLatestPrice[]> {
    const benchmarks = await this.getActive();
    const results: BenchmarkWithLatestPrice[] = [];

    for (const benchmark of benchmarks) {
      const latestPrice = await db
        .select()
        .from(schema.benchmarkPrices)
        .where(eq(schema.benchmarkPrices.benchmarkId, benchmark.id))
        .orderBy(desc(schema.benchmarkPrices.recordedDate))
        .limit(1)
        .then((r) => r[0]);

      results.push({
        ...benchmark,
        latestPrice: latestPrice?.price ?? null,
        latestDate: latestPrice?.recordedDate ?? null,
      });
    }

    return results;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await db
      .update(schema.benchmarks)
      .set({ isActive })
      .where(eq(schema.benchmarks.id, id));
  },

  // Fetch and store historical prices for a benchmark (batch insert, skip existing dates)
  async fetchHistoricalPrices(
    benchmarkId: string,
    symbol: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<void> {
    try {
      const prices = await yahooFinanceProvider.getHistoricalPrices(
        symbol,
        startDate,
        endDate
      );

      if (prices.length === 0) return;

      const existingDates = new Set(
        (await db
          .select({ date: schema.benchmarkPrices.recordedDate })
          .from(schema.benchmarkPrices)
          .where(eq(schema.benchmarkPrices.benchmarkId, benchmarkId))
        ).map((r) => r.date)
      );

      const now = new Date();
      const newRows = prices
        .map((p) => ({
          id: nanoid(),
          benchmarkId,
          price: p.close,
          recordedDate: dateToLocal(p.date),
          createdAt: now,
        }))
        .filter((r) => r.price > 0 && !existingDates.has(r.recordedDate));

      for (let i = 0; i < newRows.length; i += 500) {
        await db.insert(schema.benchmarkPrices).values(newRows.slice(i, i + 500));
      }
    } catch (error) {
      console.error(`Failed to fetch prices for ${symbol}:`, error);
    }
  },

  // Update all active benchmarks with latest prices
  async updateAllBenchmarkPrices(): Promise<{ updated: number; failed: number }> {
    const benchmarks = await this.getActive();
    let updated = 0;
    let failed = 0;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    for (const benchmark of benchmarks) {
      try {
        await this.fetchHistoricalPrices(benchmark.id, benchmark.symbol, startDate, endDate);
        updated++;
      } catch (error) {
        console.error(`Failed to update ${benchmark.symbol}:`, error);
        failed++;
      }
    }

    return { updated, failed };
  },

  // Get price history for a benchmark within an interval
  async getPriceHistory(
    benchmarkId: string,
    interval: TimeInterval,
    overrideStartStr?: string,
    overrideEndStr?: string
  ): Promise<{ date: string; price: number }[]> {
    const startDate = getStartDate(interval, overrideStartStr);
    const startDateStr = dateToLocal(startDate);

    const conditions = [
      eq(schema.benchmarkPrices.benchmarkId, benchmarkId),
      gte(schema.benchmarkPrices.recordedDate, startDateStr),
    ];
    if (overrideEndStr) {
      conditions.push(lte(schema.benchmarkPrices.recordedDate, overrideEndStr));
    }

    const prices = await db
      .select({
        date: schema.benchmarkPrices.recordedDate,
        price: schema.benchmarkPrices.price,
      })
      .from(schema.benchmarkPrices)
      .where(and(...conditions))
      .orderBy(schema.benchmarkPrices.recordedDate);
    return prices;
  },

  // Get performance for a benchmark over an interval
  async getPerformance(
    symbol: string,
    interval: TimeInterval,
    overrideStartStr?: string,
    overrideEndStr?: string
  ): Promise<BenchmarkPerformance | null> {
    const benchmark = await this.getBySymbol(symbol);
    if (!benchmark) return null;

    const startDate = getStartDate(interval, overrideStartStr);

    // Only fetch from Yahoo if latest stored price is stale (> 1 day old)
    const latestStored = await db
      .select({ date: schema.benchmarkPrices.recordedDate })
      .from(schema.benchmarkPrices)
      .where(eq(schema.benchmarkPrices.benchmarkId, benchmark.id))
      .orderBy(desc(schema.benchmarkPrices.recordedDate))
      .limit(1)
      .then((r) => r[0]);

    const yesterday = dateToLocal(new Date(Date.now() - 86400000));
    const needsRefresh = !latestStored || latestStored.date < yesterday;

    if (needsRefresh) {
      // Only fetch the gap: from last stored date (or interval start) to now
      const fetchFrom = latestStored
        ? new Date(latestStored.date)
        : startDate;
      await this.fetchHistoricalPrices(benchmark.id, symbol, fetchFrom);
    }

    // Also check if we have data covering the interval start
    const earliestStored = await db
      .select({ date: schema.benchmarkPrices.recordedDate })
      .from(schema.benchmarkPrices)
      .where(eq(schema.benchmarkPrices.benchmarkId, benchmark.id))
      .orderBy(schema.benchmarkPrices.recordedDate)
      .limit(1)
      .then((r) => r[0]);

    const startDateStr = dateToLocal(startDate);
    if (!earliestStored || earliestStored.date > startDateStr) {
      // Need historical data before what we have
      const fetchEnd = earliestStored ? new Date(earliestStored.date) : new Date();
      await this.fetchHistoricalPrices(benchmark.id, symbol, startDate, fetchEnd);
    }

    const priceHistory = await this.getPriceHistory(benchmark.id, interval, overrideStartStr, overrideEndStr);

    if (priceHistory.length < 2) {
      return null;
    }

    const startPrice = priceHistory[0].price;
    const endPrice = priceHistory[priceHistory.length - 1].price;
    const change = endPrice - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;

    return {
      symbol: benchmark.symbol,
      name: benchmark.name,
      region: benchmark.region,
      startPrice,
      endPrice,
      change,
      changePercent,
      priceHistory,
    };
  },

  // Get performance for multiple benchmarks
  async getMultiplePerformance(
    symbols: string[],
    interval: TimeInterval,
    overrideStartStr?: string,
    overrideEndStr?: string
  ): Promise<BenchmarkPerformance[]> {
    const results: BenchmarkPerformance[] = [];

    for (const symbol of symbols) {
      const perf = await this.getPerformance(symbol, interval, overrideStartStr, overrideEndStr);
      if (perf) {
        results.push(perf);
      }
    }

    return results;
  },

  // Add a custom benchmark
  async addCustomBenchmark(
    symbol: string,
    name: string,
    region: string
  ): Promise<Benchmark> {
    const now = new Date();
    const newBenchmark = {
      id: nanoid(),
      symbol,
      name,
      region,
      isActive: true,
      createdAt: now,
    };

    await db.insert(schema.benchmarks).values(newBenchmark);
    return newBenchmark as Benchmark;
  },

  // Delete a benchmark
  async deleteBenchmark(id: string): Promise<void> {
    await db.delete(schema.benchmarks).where(eq(schema.benchmarks.id, id));
  },

  // Backfill historical data for all active benchmarks that have sparse data
  async backfillAllBenchmarks(): Promise<{ updated: number; skipped: number; failed: number }> {
    const benchmarks = await this.getActive();
    let updated = 0, skipped = 0, failed = 0;

    for (const benchmark of benchmarks) {
      try {
        const count = await db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(schema.benchmarkPrices)
          .where(eq(schema.benchmarkPrices.benchmarkId, benchmark.id))
          .then((r) => r[0]?.cnt ?? 0);

        if (count > 100) {
          skipped++;
          continue;
        }

        console.log(`Backfilling ${benchmark.symbol} (${count} existing records)...`);
        const startDate = new Date(2020, 0, 1);
        await this.fetchHistoricalPrices(benchmark.id, benchmark.symbol, startDate);
        updated++;
      } catch (error) {
        console.error(`Failed to backfill ${benchmark.symbol}:`, error);
        failed++;
      }
    }

    return { updated, skipped, failed };
  },
};
