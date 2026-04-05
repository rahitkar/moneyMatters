import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cashFlowService } from '../services/cash-flow.service.js';

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  tag: z.enum(['need', 'luxury']).optional(),
  defaultBudget: z.number().min(0).optional(),
  sortOrder: z.number().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  tag: z.enum(['need', 'luxury']).optional(),
  defaultBudget: z.number().min(0).optional(),
  sortOrder: z.number().optional(),
});

const upsertEntrySchema = z.object({
  categoryId: z.string().min(1),
  entryMonth: monthSchema,
  budget: z.number().optional(),
  actual: z.number().optional(),
  notes: z.string().optional(),
});

const updateEntrySchema = z.object({
  budget: z.number().optional(),
  actual: z.number().optional(),
  notes: z.string().optional(),
});

const monthConfigSchema = z.object({
  openingBalance: z.number().min(0).optional(),
  expenseLimit: z.number().min(0).optional(),
  investmentTarget: z.number().min(0).optional(),
  savingsTarget: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const createPaymentMethodSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer']),
});

const addSpendSchema = z.object({
  categoryId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  amount: z.number(),
  description: z.string().optional(),
  spendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['expense', 'income']),
});

const updateSpendSchema = z.object({
  categoryId: z.string().min(1).optional(),
  paymentMethodId: z.string().min(1).optional(),
  amount: z.number().optional(),
  description: z.string().optional(),
  spendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const settingsSchema = z.object({
  cycleStartDay: z.number().int().min(1).max(28).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function cashFlowRoutes(fastify: FastifyInstance) {
  // ── Settings ──────────────────────────────────────────────────

  fastify.get('/settings', async () => {
    return cashFlowService.getSettings();
  });

  fastify.put<{ Body: z.infer<typeof settingsSchema> }>(
    '/settings',
    async (request, reply) => {
      const v = settingsSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const settings = await cashFlowService.updateSettings(v.data);
      return settings;
    },
  );

  // ── Categories ────────────────────────────────────────────────

  fastify.get('/categories', async () => {
    const categories = await cashFlowService.getCategories();
    return { categories };
  });

  fastify.post<{ Body: z.infer<typeof createCategorySchema> }>(
    '/categories',
    async (request, reply) => {
      const v = createCategorySchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const category = await cashFlowService.createCategory(v.data);
      return { category };
    },
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateCategorySchema> }>(
    '/categories/:id',
    async (request, reply) => {
      const v = updateCategorySchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const category = await cashFlowService.updateCategory(request.params.id, v.data);
      if (!category) return reply.status(404).send({ error: 'Category not found' });
      return { category };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/categories/:id',
    async (request, reply) => {
      const ok = await cashFlowService.deleteCategory(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Category not found' });
      return { success: true };
    },
  );

  // ── Monthly summary ───────────────────────────────────────────

  fastify.get<{ Querystring: { month: string } }>(
    '/summary',
    async (request, reply) => {
      const month = monthSchema.safeParse(request.query.month);
      if (!month.success) return reply.status(400).send({ error: 'Invalid month format (YYYY-MM)' });
      const summary = await cashFlowService.getMonthSummary(month.data);
      return { summary };
    },
  );

  // ── Yearly summary ────────────────────────────────────────────

  fastify.get<{ Querystring: { year: string } }>(
    '/yearly',
    async (request, reply) => {
      const year = request.query.year;
      if (!/^\d{4}$/.test(year)) return reply.status(400).send({ error: 'Invalid year' });
      const summary = await cashFlowService.getYearlySummary(year);
      return { summary };
    },
  );

  // ── Init month ────────────────────────────────────────────────

  fastify.post<{ Body: { month: string } }>(
    '/init-month',
    async (request, reply) => {
      const month = monthSchema.safeParse(request.body.month);
      if (!month.success) return reply.status(400).send({ error: 'Invalid month format' });
      const result = await cashFlowService.initMonth(month.data);
      return result;
    },
  );

  // ── Entries ───────────────────────────────────────────────────

  fastify.post<{ Body: z.infer<typeof upsertEntrySchema> }>(
    '/entries',
    async (request, reply) => {
      const v = upsertEntrySchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const entry = await cashFlowService.upsertEntry(v.data);
      return { entry };
    },
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateEntrySchema> }>(
    '/entries/:id',
    async (request, reply) => {
      const v = updateEntrySchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const entry = await cashFlowService.updateEntry(request.params.id, v.data);
      if (!entry) return reply.status(404).send({ error: 'Entry not found' });
      return { entry };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/entries/:id',
    async (request, reply) => {
      const ok = await cashFlowService.deleteEntry(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Entry not found' });
      return { success: true };
    },
  );

  // ── Monthly Income ────────────────────────────────────────────

  fastify.get<{ Querystring: { month: string } }>(
    '/income',
    async (request, reply) => {
      const month = monthSchema.safeParse(request.query.month);
      if (!month.success) return reply.status(400).send({ error: 'Invalid month' });
      const income = await cashFlowService.getIncome(month.data);
      return { income };
    },
  );

  fastify.put<{ Querystring: { month: string }; Body: z.infer<typeof monthConfigSchema> }>(
    '/income',
    async (request, reply) => {
      const month = monthSchema.safeParse(request.query.month);
      if (!month.success) return reply.status(400).send({ error: 'Invalid month' });
      const v = monthConfigSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const income = await cashFlowService.upsertMonthConfig(month.data, v.data);
      return { income };
    },
  );

  // ── Payment Methods ──────────────────────────────────────────

  fastify.get('/payment-methods', async () => {
    const methods = await cashFlowService.getPaymentMethods();
    return { methods };
  });

  fastify.post<{ Body: z.infer<typeof createPaymentMethodSchema> }>(
    '/payment-methods',
    async (request, reply) => {
      const v = createPaymentMethodSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const method = await cashFlowService.createPaymentMethod(v.data.name, v.data.type);
      return { method };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/payment-methods/:id',
    async (request, reply) => {
      const ok = await cashFlowService.deletePaymentMethod(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Payment method not found' });
      return { success: true };
    },
  );

  // ── Spends ───────────────────────────────────────────────────

  fastify.get<{ Querystring: { month: string } }>(
    '/spends',
    async (request, reply) => {
      const month = monthSchema.safeParse(request.query.month);
      if (!month.success) return reply.status(400).send({ error: 'Invalid month format' });
      const spends = await cashFlowService.getSpendsForMonth(month.data);
      return { spends };
    },
  );

  fastify.post<{ Body: z.infer<typeof addSpendSchema> }>(
    '/spends',
    async (request, reply) => {
      const v = addSpendSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const spend = await cashFlowService.addSpend(v.data);
      return { spend };
    },
  );

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateSpendSchema> }>(
    '/spends/:id',
    async (request, reply) => {
      const v = updateSpendSchema.safeParse(request.body);
      if (!v.success) return reply.status(400).send({ error: v.error.errors });
      const spend = await cashFlowService.updateSpend(request.params.id, v.data);
      if (!spend) return reply.status(404).send({ error: 'Spend not found' });
      return { spend };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/spends/:id',
    async (request, reply) => {
      const ok = await cashFlowService.deleteSpend(request.params.id);
      if (!ok) return reply.status(404).send({ error: 'Spend not found' });
      return { success: true };
    },
  );
}
