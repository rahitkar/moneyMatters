import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { marketDataService } from './market-data.service.js';
import { performanceService } from './performance.service.js';
import { benchmarkService } from './benchmark.service.js';
import { db, schema, sqlite } from '../db/index.js';

let snapshotTask: cron.ScheduledTask | null = null;

export function startPriceUpdateScheduler() {
  // Daily refresh + snapshot after US market close (9:30 PM UTC = 3 AM IST / 5:30 PM EDT)
  snapshotTask = cron.schedule('30 21 * * 1-5', async () => {
    console.log('Running daily price refresh...');
    try {
      const priceResult = await marketDataService.updateAllPrices();
      console.log(`Daily price update: ${priceResult.updated} updated, ${priceResult.failed} failed`);

      const bmResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Daily benchmark update: ${bmResult.updated} updated, ${bmResult.failed} failed`);

      const snapshot = await performanceService.takeSnapshot();
      if (snapshot) {
        console.log(`Snapshot taken: Value=${snapshot.totalValue}, Cost=${snapshot.totalCost}`);
      }
    } catch (error) {
      console.error('Daily refresh/snapshot error:', error);
    }
  });

  // Fetch latest prices + snapshot on startup
  setTimeout(async () => {
    // One-time dedup: remove consecutive price_history rows with the same price
    try {
      const deleted = sqlite.prepare(`
        DELETE FROM price_history
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
              ROUND(price, 4) AS rp,
              ROUND(LAG(price) OVER (PARTITION BY asset_id ORDER BY recorded_at), 4) AS prev_rp
            FROM price_history
          )
          WHERE rp = prev_rp
        )
      `).run();
      if (deleted.changes > 0) {
        console.log(`Dedup: removed ${deleted.changes} duplicate price_history rows`);
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

      const snapshot = await performanceService.takeSnapshot();
      if (snapshot) {
        console.log(`Startup snapshot: Value=${snapshot.totalValue}`);
      }

      const [{ cnt }] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(schema.priceHistory)
        .all();
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
  const snapshot = await performanceService.takeSnapshot();
  
  return {
    prices: priceResult,
    benchmarks: benchmarkResult,
    snapshot,
  };
}
