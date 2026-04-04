import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { holdingService } from '../services/holding.service.js';
import { assetService } from '../services/asset.service.js';

const createHoldingSchema = z.object({
  assetId: z.string().min(1),
  quantity: z.number().positive(),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

const updateHoldingSchema = z.object({
  quantity: z.number().positive().optional(),
  purchasePrice: z.number().positive().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export async function holdingRoutes(fastify: FastifyInstance) {
  // Get all holdings
  fastify.get('/', async () => {
    const holdings = await holdingService.getAll();
    return { holdings };
  });

  // Get all holdings with asset details
  fastify.get('/with-assets', async () => {
    const holdings = await holdingService.getAllWithAssets();
    return { holdings };
  });

  // Get holding by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const holding = await holdingService.getById(request.params.id);
    if (!holding) {
      return reply.status(404).send({ error: 'Holding not found' });
    }
    return { holding };
  });

  // Get holdings by asset ID
  fastify.get<{ Params: { assetId: string } }>(
    '/asset/:assetId',
    async (request) => {
      const holdings = await holdingService.getByAssetId(request.params.assetId);
      return { holdings };
    }
  );

  // Create holding
  fastify.post<{ Body: z.infer<typeof createHoldingSchema> }>(
    '/',
    async (request, reply) => {
      const validation = createHoldingSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      // Verify asset exists
      const asset = await assetService.getById(validation.data.assetId);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      const holding = await holdingService.create(validation.data);
      return reply.status(201).send({ holding });
    }
  );

  // Update holding
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateHoldingSchema> }>(
    '/:id',
    async (request, reply) => {
      const validation = updateHoldingSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const holding = await holdingService.update(request.params.id, validation.data);
      if (!holding) {
        return reply.status(404).send({ error: 'Holding not found' });
      }

      return { holding };
    }
  );

  // Delete holding
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const holding = await holdingService.getById(request.params.id);
    if (!holding) {
      return reply.status(404).send({ error: 'Holding not found' });
    }

    await holdingService.delete(request.params.id);
    return { success: true };
  });
}
