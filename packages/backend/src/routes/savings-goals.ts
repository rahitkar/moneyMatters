import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { savingsGoalService } from '../services/savings-goal.service.js';

const createBucketSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

const createGoalSchema = z.object({
  bucketId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  links: z.string().optional(),
  targetAmount: z.number().min(0),
  currency: z.string().optional(),
  deadline: z.string().nullable().optional(),
  savingsPercent: z.number().min(0).max(100).optional(),
  icon: z.string().optional(),
});

const updateGoalSchema = createGoalSchema.partial().extend({
  isActive: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number(),
      type: z.enum(['goal', 'bucket']),
    })
  ),
});

export async function savingsGoalRoutes(fastify: FastifyInstance) {
  // ── Buckets ────────────────────────────────────────────────────

  fastify.get('/buckets', async (request) => {
    const buckets = await savingsGoalService.getBuckets(request.userId);
    return { buckets };
  });

  fastify.post<{ Body: z.infer<typeof createBucketSchema> }>(
    '/buckets',
    async (request, reply) => {
      const v = createBucketSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const bucket = await savingsGoalService.createBucket(request.userId, v.data);
      return { bucket };
    }
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof createBucketSchema> }>(
    '/buckets/:id',
    async (request, reply) => {
      const v = createBucketSchema.partial().safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const bucket = await savingsGoalService.updateBucket(request.userId, request.params.id, v.data);
      if (!bucket) return reply.status(404).send({ error: 'Bucket not found' });
      return { bucket };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/buckets/:id',
    async (request, reply) => {
      const ok = await savingsGoalService.deleteBucket(request.userId, request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Bucket not found' });
      return { success: true };
    }
  );

  // ── Goals ──────────────────────────────────────────────────────

  fastify.get('/', async (request) => {
    const goals = await savingsGoalService.getGoals(request.userId);
    return { goals };
  });

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const goal = await savingsGoalService.getGoalById(request.userId, request.params.id);
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      return { goal };
    }
  );

  fastify.post<{ Body: z.infer<typeof createGoalSchema> }>(
    '/',
    async (request, reply) => {
      const v = createGoalSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const goal = await savingsGoalService.createGoal(request.userId, v.data);
      return { goal };
    }
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateGoalSchema> }>(
    '/:id',
    async (request, reply) => {
      const v = updateGoalSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const goal = await savingsGoalService.updateGoal(request.userId, request.params.id, v.data);
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      return { goal };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const ok = await savingsGoalService.deleteGoal(request.userId, request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Goal not found' });
      return { success: true };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/:id/complete',
    async (request, reply) => {
      const goal = await savingsGoalService.completeGoal(request.userId, request.params.id);
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      return { goal };
    }
  );

  // ── Reorder ────────────────────────────────────────────────────

  fastify.put<{ Body: z.infer<typeof reorderSchema> }>(
    '/reorder',
    async (request, reply) => {
      const v = reorderSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      await savingsGoalService.reorder(request.userId, v.data.items);
      return { success: true };
    }
  );

  // ── Progress & Contributions ───────────────────────────────────

  fastify.get('/progress', async (request) => {
    const result = await savingsGoalService.getAllProgress(request.userId);
    return result;
  });

  fastify.get<{ Params: { id: string } }>(
    '/:id/contributions',
    async (request, reply) => {
      const goal = await savingsGoalService.getGoalById(request.userId, request.params.id);
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      const contributions = await savingsGoalService.getContributions(request.params.id);
      return { contributions };
    }
  );

  fastify.put<{ Params: { id: string; month: string }; Body: { amount: number; notes?: string } }>(
    '/:id/contributions/:month',
    async (request, reply) => {
      const goal = await savingsGoalService.getGoalById(request.userId, request.params.id);
      if (!goal) return reply.status(404).send({ error: 'Goal not found' });
      const { amount, notes } = request.body;
      if (typeof amount !== 'number') return reply.status(400).send({ error: 'amount is required' });
      const contribution = await savingsGoalService.overrideContribution(
        request.params.id, request.params.month, amount, notes
      );
      return { contribution };
    }
  );

  // ── Allocations ────────────────────────────────────────────────

  fastify.get<{ Querystring: { month?: string } }>(
    '/allocations',
    async (request) => {
      const now = new Date();
      const month = (request.query as any).month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const result = await savingsGoalService.previewAllocations(request.userId, month);
      return result;
    }
  );

  fastify.post<{ Body: { month?: string } }>(
    '/allocations',
    async (request) => {
      const now = new Date();
      const month = (request.body as any).month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const contributions = await savingsGoalService.recordAllocations(request.userId, month);
      return { contributions };
    }
  );
}
