import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { marketDataService } from '../services/market-data.service.js';
import { triggerManualPriceUpdate } from '../services/scheduler.service.js';
import { ASSET_CLASSES } from '../db/schema.js';

const searchSchema = z.object({
  query: z.string().min(1),
});

const quoteSchema = z.object({
  symbol: z.string().min(1),
  assetClass: z.enum(ASSET_CLASSES).optional(),
});

const convertSchema = z.object({
  amount: z.number().positive(),
  from: z.string().length(3),
  to: z.string().length(3),
});

export async function marketDataRoutes(fastify: FastifyInstance) {
  // Search for assets
  fastify.get<{ Querystring: z.infer<typeof searchSchema> }>(
    '/search',
    async (request, reply) => {
      const validation = searchSchema.safeParse(request.query);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const results = await marketDataService.search(validation.data.query);
      return { results };
    }
  );

  // Get quote for a symbol
  fastify.get<{ Querystring: z.infer<typeof quoteSchema> }>(
    '/quote',
    async (request, reply) => {
      const validation = quoteSchema.safeParse(request.query);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const quote = await marketDataService.getQuote(
        validation.data.symbol,
        validation.data.assetClass
      );

      if (!quote) {
        return reply.status(404).send({ error: 'Quote not found' });
      }

      return { quote };
    }
  );

  // Trigger manual price update
  fastify.post('/refresh', async () => {
    const result = await triggerManualPriceUpdate();
    return {
      success: true,
      updated: result.prices.updated,
      failed: result.prices.failed,
    };
  });

  // Convert currency
  fastify.get<{ Querystring: z.infer<typeof convertSchema> }>(
    '/convert',
    async (request, reply) => {
      const validation = convertSchema.safeParse({
        ...request.query,
        amount: Number(request.query.amount),
      });
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const converted = await marketDataService.convertCurrency(
        validation.data.amount,
        validation.data.from,
        validation.data.to
      );

      if (converted === null) {
        return reply.status(400).send({ error: 'Conversion failed' });
      }

      return {
        original: {
          amount: validation.data.amount,
          currency: validation.data.from,
        },
        converted: {
          amount: converted,
          currency: validation.data.to,
        },
      };
    }
  );

  // Backfill historical prices from Yahoo/CoinGecko into price_history
  fastify.post('/backfill', async () => {
    const result = await marketDataService.backfillHistoricalPrices();
    return { success: true, ...result };
  });

  // Get exchange rate
  fastify.get<{ Params: { from: string; to: string } }>(
    '/rate/:from/:to',
    async (request, reply) => {
      const rate = await marketDataService.getExchangeRate(
        request.params.from,
        request.params.to
      );

      if (!rate) {
        return reply.status(404).send({ error: 'Exchange rate not found' });
      }

      return { rate };
    }
  );
}
