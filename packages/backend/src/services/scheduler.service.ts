import cron from 'node-cron';
import { marketDataService } from './market-data.service.js';
import { performanceService } from './performance.service.js';
import { benchmarkService } from './benchmark.service.js';

let priceUpdateTask: cron.ScheduledTask | null = null;
let snapshotTask: cron.ScheduledTask | null = null;

export function startPriceUpdateScheduler() {
  // Update prices every 15 minutes during market hours (9 AM - 5 PM UTC, Monday-Friday)
  priceUpdateTask = cron.schedule('*/15 9-17 * * 1-5', async () => {
    console.log('Running scheduled price update...');
    try {
      const result = await marketDataService.updateAllPrices();
      console.log(`Price update complete: ${result.updated} updated, ${result.failed} failed`);
      
      // Also update benchmark prices
      const benchmarkResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Benchmark update complete: ${benchmarkResult.updated} updated, ${benchmarkResult.failed} failed`);
    } catch (error) {
      console.error('Price update error:', error);
    }
  });

  // Take daily portfolio snapshot at end of day (6 PM UTC)
  snapshotTask = cron.schedule('0 18 * * 1-5', async () => {
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

  // Also run immediately on startup
  setTimeout(async () => {
    console.log('Running initial price update...');
    try {
      const result = await marketDataService.updateAllPrices();
      console.log(`Initial price update complete: ${result.updated} updated, ${result.failed} failed`);
      
      // Take initial snapshot
      const snapshot = await performanceService.takeSnapshot();
      if (snapshot) {
        console.log(`Initial snapshot taken: Value=${snapshot.totalValue}`);
      }

      // Update benchmark prices
      const benchmarkResult = await benchmarkService.updateAllBenchmarkPrices();
      console.log(`Initial benchmark update: ${benchmarkResult.updated} updated`);
    } catch (error) {
      console.error('Initial update error:', error);
    }
  }, 5000);

  console.log('Price update scheduler started');
}

export function stopPriceUpdateScheduler() {
  if (priceUpdateTask) {
    priceUpdateTask.stop();
    priceUpdateTask = null;
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
  const snapshot = await performanceService.takeSnapshot();
  
  return {
    prices: priceResult,
    benchmarks: benchmarkResult,
    snapshot,
  };
}
