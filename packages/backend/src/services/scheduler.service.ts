import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { marketDataService } from './market-data.service.js';
import { performanceService } from './performance.service.js';
import { benchmarkService } from './benchmark.service.js';
import { db, schema } from '../db/index.js';

let snapshotTask: cron.ScheduledTask | null = null;

export function startPriceUpdateScheduler() {
  // Take daily portfolio snapshot after US market close (9:30 PM UTC = 3 AM IST / 5:30 PM EDT)
  snapshotTask = cron.schedule('30 21 * * 1-5', async () => {
    console.log('Taking daily portfolio snapshot...');
    try {
      const snapshot = await performanceService.takeSnapshot();
      if (snapshot) {
        console.log(`Snapshot taken: Value=${snapshot.totalValue}, Cost=${snapshot.totalCost}`);
      }
    } catch (error) {
      console.error('Snapshot error:', error);
    }
  });

  // Fetch latest prices + snapshot on startup
  setTimeout(async () => {
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
