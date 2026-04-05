import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initializeDatabase } from './db/index.js';
import { assetRoutes } from './routes/assets.js';
import { holdingRoutes } from './routes/holdings.js';
import { tagRoutes } from './routes/tags.js';
import { marketDataRoutes } from './routes/market-data.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { importRoutes } from './routes/import.js';
import { transactionRoutes } from './routes/transactions.js';
import { performanceRoutes, benchmarkRoutes } from './routes/performance.js';
import { cashFlowRoutes } from './routes/cash-flow.js';
import { goalRoutes } from './routes/goals.js';
import { fireRoutes } from './routes/fire.js';
import { reportRoutes } from './routes/reports.js';
import { startPriceUpdateScheduler } from './services/scheduler.service.js';

const fastify = Fastify({
  logger: true,
});

// Register CORS
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
});

// Initialize database
initializeDatabase();

// Register routes
fastify.register(assetRoutes, { prefix: '/api/assets' });
fastify.register(holdingRoutes, { prefix: '/api/holdings' });
fastify.register(tagRoutes, { prefix: '/api/tags' });
fastify.register(marketDataRoutes, { prefix: '/api/market-data' });
fastify.register(portfolioRoutes, { prefix: '/api/portfolio' });
fastify.register(importRoutes, { prefix: '/api/import' });
fastify.register(transactionRoutes, { prefix: '/api/transactions' });
fastify.register(performanceRoutes, { prefix: '/api/performance' });
fastify.register(benchmarkRoutes, { prefix: '/api/benchmarks' });
fastify.register(cashFlowRoutes, { prefix: '/api/cash-flow' });
fastify.register(goalRoutes, { prefix: '/api/goals' });
fastify.register(fireRoutes, { prefix: '/api/fire' });
fastify.register(reportRoutes, { prefix: '/api/reports' });

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    // Start price update scheduler
    startPriceUpdateScheduler();

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
