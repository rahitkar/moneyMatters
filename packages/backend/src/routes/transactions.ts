import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transactionService } from '../services/transaction.service.js';
import { assetService } from '../services/asset.service.js';
import { TRANSACTION_TYPES } from '../db/schema.js';
import { getDayChanges } from '../services/portfolio.service.js';

const createTransactionSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(TRANSACTION_TYPES),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fees: z.number().min(0).optional(),
  fundSourceId: z.string().min(1).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function transactionRoutes(fastify: FastifyInstance) {
  // Register static and multi-segment paths before `/:id` so names like `positions` are not captured as ids.

  // Get all transactions
  fastify.get('/', async (request) => {
    const transactions = await transactionService.getAll(request.userId);
    return { transactions };
  });

  // Get all transactions with asset details
  fastify.get('/with-assets', async (request) => {
    const transactions = await transactionService.getAllWithAssets(request.userId);
    return { transactions };
  });

  // Get transactions by asset
  fastify.get<{ Params: { assetId: string } }>(
    '/asset/:assetId',
    async (request) => {
      const transactions = await transactionService.getByAssetId(
        request.userId,
        request.params.assetId
      );
      return { transactions };
    }
  );

  // Get all positions (computed from transactions)
  fastify.get('/positions', async (request) => {
    const positions = await transactionService.getAllPositions(request.userId);
    return { positions };
  });

  // Day change for each asset: previous close vs current price
  fastify.get('/positions/day-changes', async (request) => getDayChanges(request.userId));

  // Get position for a specific asset
  fastify.get<{ Params: { assetId: string } }>(
    '/positions/:assetId',
    async (request, reply) => {
      const position = await transactionService.getPositionForAsset(
        request.userId,
        request.params.assetId
      );
      if (!position) {
        return reply.status(404).send({ error: 'Position not found' });
      }
      return { position };
    }
  );

  // Get buy lots for an asset (FIFO view)
  fastify.get<{ Params: { assetId: string } }>(
    '/lots/:assetId',
    async (request) => {
      const lots = await transactionService.getBuyLots(request.userId, request.params.assetId);
      return { lots };
    }
  );

  // Get realized gains summary
  fastify.get('/realized-gains', async (request) => {
    const total = await transactionService.getTotalRealizedGains(request.userId);
    return { totalRealizedGains: total };
  });

  // Get realized gains by asset
  fastify.get<{ Params: { assetId: string } }>(
    '/realized-gains/:assetId',
    async (request) => {
      const gains = await transactionService.getRealizedGainsByAsset(
        request.userId,
        request.params.assetId
      );
      return { realizedGains: gains };
    }
  );

  // Create transaction (buy or sell)
  fastify.post<{ Body: z.infer<typeof createTransactionSchema> }>(
    '/',
    async (request, reply) => {
      const validation = createTransactionSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const asset = await assetService.getById(request.userId, validation.data.assetId);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      try {
        const transaction = await transactionService.create(request.userId, {
          userId: request.userId,
          ...validation.data,
        });
        return reply.status(201).send({ transaction });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Insufficient quantity')) {
          return reply.status(400).send({ error: error.message });
        }
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // Get transaction by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const transaction = await transactionService.getById(request.userId, request.params.id);
    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }
    return { transaction };
  });

  // Delete transaction
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const transaction = await transactionService.getById(request.userId, request.params.id);
    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    await transactionService.delete(request.userId, request.params.id);
    return { success: true };
  });
}
