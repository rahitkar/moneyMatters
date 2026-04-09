import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tagService } from '../services/tag.service.js';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

export async function tagRoutes(fastify: FastifyInstance) {
  // Get all tags
  fastify.get('/', async (request) => {
    const tags = await tagService.getAll(request.userId);
    return { tags };
  });

  // Get all tags with asset counts
  fastify.get('/with-counts', async (request) => {
    const tags = await tagService.getTagsWithAssetCount(request.userId);
    return { tags };
  });

  // Get tag by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const tag = await tagService.getById(request.userId, request.params.id);
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }
    return { tag };
  });

  // Get assets by tag
  fastify.get<{ Params: { id: string } }>('/:id/assets', async (request, reply) => {
    const tag = await tagService.getById(request.userId, request.params.id);
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    const assets = await tagService.getAssetsByTag(request.userId, request.params.id);
    return { tag, assets: assets.map((a) => a.asset) };
  });

  // Create tag
  fastify.post<{ Body: z.infer<typeof createTagSchema> }>(
    '/',
    async (request, reply) => {
      const validation = createTagSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      // Check if tag with same name exists
      const existing = await tagService.getByName(request.userId, validation.data.name);
      if (existing) {
        return reply.status(409).send({ 
          error: 'Tag with this name already exists',
          tag: existing 
        });
      }

      const tag = await tagService.create(request.userId, validation.data);
      return reply.status(201).send({ tag });
    }
  );

  // Update tag
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateTagSchema> }>(
    '/:id',
    async (request, reply) => {
      const validation = updateTagSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      // Check for duplicate name if name is being changed
      if (validation.data.name) {
        const existing = await tagService.getByName(request.userId, validation.data.name);
        if (existing && existing.id !== request.params.id) {
          return reply.status(409).send({ 
            error: 'Tag with this name already exists' 
          });
        }
      }

      const tag = await tagService.update(request.userId, request.params.id, validation.data);
      if (!tag) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      return { tag };
    }
  );

  // Delete tag
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const tag = await tagService.getById(request.userId, request.params.id);
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    await tagService.delete(request.userId, request.params.id);
    return { success: true };
  });
}
