import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { portfolioService } from '../services/portfolio.service.js';
import { ASSET_CLASSES } from '../db/schema.js';

export async function portfolioRoutes(fastify: FastifyInstance) {
  // Get portfolio summary
  fastify.get('/summary', async () => {
    const summary = await portfolioService.getSummary();
    return { summary };
  });

  // Get asset allocation
  fastify.get('/allocation', async () => {
    const allocation = await portfolioService.getAllocation();
    return { allocation };
  });

  // Multi-dimensional allocation (6 dimensions)
  fastify.get('/allocation/multi', async () => {
    const allocation = await portfolioService.getMultiDimensionalAllocation();
    return { allocation };
  });

  // Get all holdings with calculated values
  fastify.get('/holdings', async () => {
    const holdings = await portfolioService.getHoldingsWithValues();
    return { holdings };
  });

  // Get holdings by tag
  fastify.get<{ Params: { tagId: string } }>(
    '/holdings/tag/:tagId',
    async (request) => {
      const holdings = await portfolioService.getHoldingsByTag(request.params.tagId);
      return { holdings };
    }
  );

  // Get holdings by asset class
  fastify.get<{ Params: { assetClass: string } }>(
    '/holdings/class/:assetClass',
    async (request, reply) => {
      const assetClass = request.params.assetClass as any;
      if (!ASSET_CLASSES.includes(assetClass)) {
        return reply.status(400).send({ error: 'Invalid asset class' });
      }

      const holdings = await portfolioService.getHoldingsByAssetClass(assetClass);
      return { holdings };
    }
  );

  // Get top performers
  fastify.get<{ Querystring: { limit?: string } }>(
    '/top-performers',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit) : 5;
      const holdings = await portfolioService.getTopPerformers(limit);
      return { holdings };
    }
  );

  // Get worst performers
  fastify.get<{ Querystring: { limit?: string } }>(
    '/worst-performers',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit) : 5;
      const holdings = await portfolioService.getWorstPerformers(limit);
      return { holdings };
    }
  );
}
