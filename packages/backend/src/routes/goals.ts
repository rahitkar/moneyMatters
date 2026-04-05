import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { goalService } from '../services/goal.service.js';

const createTargetSchema = z.object({
  name: z.string().min(1),
  startingValue: z.number(),
  monthlyInvestment: z.number().min(0),
  yearlyReturnRate: z.number(),
  stretchMonthlyInvestment: z.number().min(0).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}$/),
});

const updateTargetSchema = createTargetSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function goalRoutes(fastify: FastifyInstance) {
  // List all targets
  fastify.get('/targets', async () => {
    const targets = await goalService.getTargets();
    return { targets };
  });

  // Get single target
  fastify.get<{ Params: { id: string } }>(
    '/targets/:id',
    async (request, reply) => {
      const target = await goalService.getTargetById(request.params.id);
      if (!target) return reply.status(404).send({ error: 'Target not found' });
      return { target };
    },
  );

  // Create target
  fastify.post<{ Body: z.infer<typeof createTargetSchema> }>(
    '/targets',
    async (request, reply) => {
      const v = createTargetSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const target = await goalService.createTarget(v.data);
      return { target };
    },
  );

  // Update target
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateTargetSchema> }>(
    '/targets/:id',
    async (request, reply) => {
      const v = updateTargetSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const target = await goalService.updateTarget(request.params.id, v.data);
      if (!target) return reply.status(404).send({ error: 'Target not found' });
      return { target };
    },
  );

  // Delete target
  fastify.delete<{ Params: { id: string } }>(
    '/targets/:id',
    async (request, reply) => {
      const ok = await goalService.deleteTarget(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Target not found' });
      return { success: true };
    },
  );

  // Get projection for a target
  fastify.get<{ Params: { id: string } }>(
    '/targets/:id/projection',
    async (request, reply) => {
      const projection = await goalService.getProjection(request.params.id);
      if (!projection) return reply.status(404).send({ error: 'Target not found' });
      return { projection };
    },
  );
}
