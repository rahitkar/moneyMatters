import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { marketDataService } from './market-data.service.js';
import { performanceService } from './performance.service.js';
import { benchmarkService } from './benchmark.service.js';
import { db, schema } from '../db/index.js';
import { users } from '../db/schema.js';

let snapshotTask: cron.ScheduledTask | null = null;
let indianMarketTask: cron.ScheduledTask | null = null;

export function startPriceUpdateScheduler() {
  // Indian market + MF NAV refresh: 7:30 PM IST = 14:00 UTC (weekdays)
  // Captures Indian close prices and MF NAVs (published ~10-11 PM IST)
  indianMarketTask = cron.schedule('0 14 * * 1-5', async () => {
    console.log('Running Indian market price refresh...');
    try {
      const priceResult = await marketDataService.updateAllPrices();
      console.log(`Indian refresh: ${priceResult.updated} updated, ${priceResult.failed} failed`);

      const bmResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Indian benchmark update: ${bmResult.updated} updated, ${bmResult.failed} failed`);
    } catch (error) {
      console.error('Indian market refresh error:', error);
    }
  });

  // US market close + full snapshot (9:30 PM UTC = 3 AM IST / 5:30 PM EDT, weekdays)
  snapshotTask = cron.schedule('30 21 * * 1-5', async () => {
    console.log('Running daily price refresh + snapshot...');
    try {
      const priceResult = await marketDataService.updateAllPrices();
      console.log(`Daily price update: ${priceResult.updated} updated, ${priceResult.failed} failed`);

      const bmResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Daily benchmark update: ${bmResult.updated} updated, ${bmResult.failed} failed`);

      const userRows = await db.select({ id: users.id }).from(users);
      for (const { id } of userRows) {
        const snapshot = await performanceService.takeSnapshot(id);
        if (snapshot) {
          console.log(`Snapshot [${id}]: Value=${snapshot.totalValue}, Cost=${snapshot.totalCost}`);
        }
      }
    } catch (error) {
      console.error('Daily refresh/snapshot error:', error);
    }
  });

  // Fetch latest prices + snapshot on startup
  setTimeout(async () => {
    // One-time dedup: remove consecutive price_history rows with the same price
    try {
      const result = await db.execute(sql`
        DELETE FROM price_history
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
              ROUND(CAST(price AS numeric), 4) AS rp,
              ROUND(CAST(LAG(price) OVER (PARTITION BY asset_id ORDER BY recorded_at) AS numeric), 4) AS prev_rp
            FROM price_history
          ) sub
          WHERE rp = prev_rp
        )
      `);
      const deletedCount = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      if (deletedCount > 0) {
        console.log(`Dedup: removed ${deletedCount} duplicate price_history rows`);
      }
    } catch (err) {
      console.error('Price history dedup error:', err);
    }

    console.log('Running startup price update...');
    try {
      const result = await marketDataService.updateAllPrices();
      console.log(`Startup price update: ${result.updated} updated, ${result.failed} failed`);

      const benchmarkResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Startup benchmark update: ${benchmarkResult.updated} updated, ${benchmarkResult.failed} failed`);

      const userRows = await db.select({ id: users.id }).from(users);
      for (const { id } of userRows) {
        const snapshot = await performanceService.takeSnapshot(id);
        if (snapshot) {
          console.log(`Startup snapshot [${id}]: Value=${snapshot.totalValue}`);
        }
      }

      const [{ cnt }] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(schema.priceHistory);
      if (cnt < 100) {
        console.log(`Price history sparse (${cnt} records), triggering backfill...`);
        const backfillResult = await marketDataService.backfillHistoricalPrices();
        console.log(`Backfill complete: ${backfillResult.updated} filled, ${backfillResult.skipped} skipped, ${backfillResult.failed} failed`);
      }

      const bmResult = await benchmarkService.backfillAllBenchmarks();
      if (bmResult.updated > 0) {
        console.log(`Benchmark backfill: ${bmResult.updated} filled, ${bmResult.skipped} skipped, ${bmResult.failed} failed`);
      }
    } catch (error) {
      console.error('Startup update error:', error);
    }
  }, 5000);

  console.log('Price update scheduler started');
}

export function stopPriceUpdateScheduler() {
  if (indianMarketTask) {
    indianMarketTask.stop();
    indianMarketTask = null;
  }
  if (snapshotTask) {
    snapshotTask.stop();
    snapshotTask = null;
  }
  console.log('Schedulers stopped');
}

export async function triggerManualPriceUpdate() {
  console.log('Manual price update triggered...');
  const priceResult = await marketDataService.updateAllPrices();
  const benchmarkResult = await benchmarkService.updateAllBenchmarkPrices();
  const userRows = await db.select({ id: users.id }).from(users);
  const snapshots: Awaited<ReturnType<typeof performanceService.takeSnapshot>>[] = [];
  for (const { id } of userRows) {
    const s = await performanceService.takeSnapshot(id);
    if (s) snapshots.push(s);
  }

  return {
    prices: priceResult,
    benchmarks: benchmarkResult,
    snapshots,
  };
}
