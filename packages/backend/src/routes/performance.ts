import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { performanceService } from '../services/performance.service.js';
import { benchmarkService } from '../services/benchmark.service.js';
import { TIME_INTERVALS, ASSET_CLASSES } from '../db/schema.js';

const intervalSchema = z.enum(TIME_INTERVALS).optional().default('1M');

const compareSchema = z.object({
  interval: z.enum(TIME_INTERVALS).optional().default('1M'),
  benchmarks: z.string().optional(), // Comma-separated symbols
});

export async function performanceRoutes(fastify: FastifyInstance) {
  // Get portfolio performance for an interval
  fastify.get<{ Querystring: { interval?: string } }>(
    '/portfolio',
    async (request) => {
      const interval = intervalSchema.parse(request.query.interval);
      const performance = await performanceService.getPortfolioPerformance(interval);
      return { performance };
    }
  );

  // Compare portfolio with benchmarks
  fastify.get<{ Querystring: { interval?: string; benchmarks?: string } }>(
    '/compare',
    async (request) => {
      const { interval, benchmarks } = compareSchema.parse(request.query);
      
      // Default to S&P 500 and Nifty if no benchmarks specified
      const benchmarkSymbols = benchmarks
        ? benchmarks.split(',').map((s) => s.trim())
        : ['^GSPC', '^NSEI'];

      const comparison = await performanceService.compareWithBenchmarks(
        interval,
        benchmarkSymbols
      );
      return { comparison };
    }
  );

  // Get performance by asset class
  fastify.get<{ Querystring: { interval?: string } }>(
    '/by-asset-class',
    async (request) => {
      const interval = intervalSchema.parse(request.query.interval);
      const performance = await performanceService.getPerformanceByAssetClass(interval);
      return { performance };
    }
  );

  // Get performance for a specific asset class
  fastify.get<{ Params: { assetClass: string }; Querystring: { interval?: string } }>(
    '/asset-class/:assetClass',
    async (request, reply) => {
      const assetClass = request.params.assetClass as any;
      if (!ASSET_CLASSES.includes(assetClass)) {
        return reply.status(400).send({ error: 'Invalid asset class' });
      }

      const interval = intervalSchema.parse(request.query.interval);
      const allPerformance = await performanceService.getPerformanceByAssetClass(interval);
      const classPerformance = allPerformance.find((p) => p.assetClass === assetClass);

      if (!classPerformance) {
        return { performance: null };
      }

      return { performance: classPerformance };
    }
  );

  // Get performance by tag
  fastify.get<{ Params: { tagId: string }; Querystring: { interval?: string } }>(
    '/tag/:tagId',
    async (request, reply) => {
      const interval = intervalSchema.parse(request.query.interval);
      const performance = await performanceService.getPerformanceByTag(
        request.params.tagId,
        interval
      );

      if (!performance) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      return { performance };
    }
  );

  // Get portfolio snapshots (for charting)
  fastify.get<{ Querystring: { interval?: string } }>(
    '/snapshots',
    async (request) => {
      const interval = intervalSchema.parse(request.query.interval);
      const snapshots = await performanceService.getSnapshots(interval);
      return { snapshots };
    }
  );

  // Manually trigger a portfolio snapshot
  fastify.post('/snapshot', async () => {
    const snapshot = await performanceService.takeSnapshot();
    return { snapshot };
  });
}

// Benchmark routes
export async function benchmarkRoutes(fastify: FastifyInstance) {
  // Get all benchmarks
  fastify.get('/', async () => {
    const benchmarks = await benchmarkService.getAllWithLatestPrices();
    return { benchmarks };
  });

  // Get active benchmarks only
  fastify.get('/active', async () => {
    const benchmarks = await benchmarkService.getActive();
    return { benchmarks };
  });

  // Get benchmark by symbol
  fastify.get<{ Params: { symbol: string } }>('/:symbol', async (request, reply) => {
    const benchmark = await benchmarkService.getBySymbol(request.params.symbol);
    if (!benchmark) {
      return reply.status(404).send({ error: 'Benchmark not found' });
    }
    return { benchmark };
  });

  // Get benchmark performance
  fastify.get<{ Params: { symbol: string }; Querystring: { interval?: string } }>(
    '/:symbol/performance',
    async (request, reply) => {
      const interval = intervalSchema.parse(request.query.interval);
      const performance = await benchmarkService.getPerformance(
        request.params.symbol,
        interval
      );

      if (!performance) {
        return reply.status(404).send({ error: 'Benchmark not found or no data available' });
      }

      return { performance };
    }
  );

  // Get benchmark price history
  fastify.get<{ Params: { symbol: string }; Querystring: { interval?: string } }>(
    '/:symbol/history',
    async (request, reply) => {
      const interval = intervalSchema.parse(request.query.interval);
      const benchmark = await benchmarkService.getBySymbol(request.params.symbol);

      if (!benchmark) {
        return reply.status(404).send({ error: 'Benchmark not found' });
      }

      const history = await benchmarkService.getPriceHistory(benchmark.id, interval);
      return { symbol: request.params.symbol, history };
    }
  );

  // Toggle benchmark active status
  fastify.put<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/:id/toggle',
    async (request, reply) => {
      const benchmark = await benchmarkService.getById(request.params.id);
      if (!benchmark) {
        return reply.status(404).send({ error: 'Benchmark not found' });
      }

      await benchmarkService.toggleActive(request.params.id, request.body.isActive);
      return { success: true };
    }
  );

  // Update all benchmark prices
  fastify.post('/refresh', async () => {
    const result = await benchmarkService.updateAllBenchmarkPrices();
    return { success: true, ...result };
  });

  // Add custom benchmark
  fastify.post<{ Body: { symbol: string; name: string; region: string } }>(
    '/',
    async (request, reply) => {
      const { symbol, name, region } = request.body;

      if (!symbol || !name || !region) {
        return reply.status(400).send({ error: 'symbol, name, and region are required' });
      }

      // Check if already exists
      const existing = await benchmarkService.getBySymbol(symbol);
      if (existing) {
        return reply.status(409).send({ error: 'Benchmark with this symbol already exists' });
      }

      const benchmark = await benchmarkService.addCustomBenchmark(symbol, name, region);
      return reply.status(201).send({ benchmark });
    }
  );

  // Delete benchmark
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const benchmark = await benchmarkService.getById(request.params.id);
    if (!benchmark) {
      return reply.status(404).send({ error: 'Benchmark not found' });
    }

    await benchmarkService.deleteBenchmark(request.params.id);
    return { success: true };
  });
}
