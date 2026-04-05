import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fireService } from '../services/fire.service.js';

const fireInputSchema = z.object({
  name: z.string().min(1),
  currentAge: z.number().int().min(1),
  retirementAge: z.number().int().min(1),
  lifeExpectancy: z.number().int().min(1),
  currentSavings: z.number(),
  monthlySaving: z.number().min(0),
  annualSavingsIncrease: z.number().min(0),   // 0.22 = 22%
  returnOnInvestment: z.number(),              // 0.125 = 12.5%
  capitalGainTax: z.number().min(0).max(1),
  postRetirementMonthlyExpense: z.number().min(0),
  inflationRate: z.number().min(0),
  startYear: z.number().int(),
});

const fireUpdateSchema = fireInputSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function fireRoutes(fastify: FastifyInstance) {
  fastify.get('/simulations', async () => {
    const simulations = await fireService.getAll();
    return { simulations };
  });

  fastify.get<{ Params: { id: string } }>(
    '/simulations/:id',
    async (request, reply) => {
      const sim = await fireService.getById(request.params.id);
      if (!sim) return reply.status(404).send({ error: 'Simulation not found' });
      return { simulation: sim };
    },
  );

  fastify.post<{ Body: z.infer<typeof fireInputSchema> }>(
    '/simulations',
    async (request, reply) => {
      const v = fireInputSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const simulation = await fireService.create(v.data);
      return { simulation };
    },
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof fireUpdateSchema> }>(
    '/simulations/:id',
    async (request, reply) => {
      const v = fireUpdateSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const simulation = await fireService.update(request.params.id, v.data);
      if (!simulation) return reply.status(404).send({ error: 'Simulation not found' });
      return { simulation };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/simulations/:id',
    async (request, reply) => {
      const ok = await fireService.delete(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Simulation not found' });
      return { success: true };
    },
  );

  // Run simulation and return full projection
  fastify.get<{ Params: { id: string } }>(
    '/simulations/:id/run',
    async (request, reply) => {
      const result = await fireService.getSimulationResult(request.params.id);
      if (!result) return reply.status(404).send({ error: 'Simulation not found' });
      return { result };
    },
  );

  // Auto-seed: create/reset all scenarios to Excel reference values
  fastify.post('/auto-seed', async () => {
    const result = await fireService.autoSeedScenarios();
    return { result };
  });

  // Sync portfolio: update Base/Lean/Fat currentSavings from live portfolio
  fastify.post('/sync-portfolio', async () => {
    const result = await fireService.syncPortfolio();
    return { result };
  });

  // Compare all simulations + actual portfolio
  fastify.get('/compare', async () => {
    const data = await fireService.getAllProjections();
    return { data };
  });

  // Monthly targets for a financial year (India: Apr-Mar)
  fastify.get<{ Querystring: { fy?: string } }>('/monthly-targets', async (request) => {
    const fy = request.query.fy ? parseInt(request.query.fy, 10) : undefined;
    const data = await fireService.getMonthlyTargets(fy);
    return { data };
  });

  // Preview simulation without saving (pass all inputs as query)
  fastify.post<{ Body: z.infer<typeof fireInputSchema> }>(
    '/preview',
    async (request, reply) => {
      const v = fireInputSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const result = fireService.computeFromInputs(v.data);
      return { result };
    },
  );
}
