import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assetService } from '../services/asset.service.js';
import { transactionService } from '../services/transaction.service.js';
import { marketDataService } from '../services/market-data.service.js';
import { ASSET_CLASSES, PROVIDERS } from '../db/schema.js';

const createAssetSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  assetClass: z.enum(ASSET_CLASSES),
  provider: z.enum(PROVIDERS),
  currentPrice: z.number().optional(),
  currency: z.string().optional(),
  isin: z.string().optional().nullable(),
});

const updateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  assetClass: z.enum(ASSET_CLASSES).optional(),
  currentPrice: z.number().optional(),
  currency: z.string().optional(),
  isin: z.string().optional().nullable(),
});

const updatePriceSchema = z.object({
  price: z.number().positive(),
});

const setTagsSchema = z.object({
  tagIds: z.array(z.string()),
});

export async function assetRoutes(fastify: FastifyInstance) {
  // Get all assets (includes tags)
  fastify.get('/', async () => {
    const assets = await assetService.getAllWithTags();
    return { assets };
  });

  // Get asset by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const asset = await assetService.getWithTags(request.params.id);
    if (!asset) {
      return reply.status(404).send({ error: 'Asset not found' });
    }
    return { asset };
  });

  // Get assets by asset class
  fastify.get<{ Params: { assetClass: string } }>(
    '/class/:assetClass',
    async (request, reply) => {
      const assetClass = request.params.assetClass as any;
      if (!ASSET_CLASSES.includes(assetClass)) {
        return reply.status(400).send({ error: 'Invalid asset class' });
      }
      const assets = await assetService.getByAssetClass(assetClass);
      return { assets };
    }
  );

  // Create asset
  fastify.post<{ Body: z.infer<typeof createAssetSchema> }>(
    '/',
    async (request, reply) => {
      const validation = createAssetSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      // Check if asset already exists
      const existing = await assetService.getBySymbol(validation.data.symbol);
      if (existing) {
        return reply.status(409).send({ 
          error: 'Asset with this symbol already exists',
          asset: existing 
        });
      }

      const asset = await assetService.create(validation.data);
      return reply.status(201).send({ asset });
    }
  );

  // Update asset
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updateAssetSchema> }>(
    '/:id',
    async (request, reply) => {
      const validation = updateAssetSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const asset = await assetService.update(request.params.id, validation.data);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      return { asset };
    }
  );

  // Delete asset
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const asset = await assetService.getById(request.params.id);
    if (!asset) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    await assetService.delete(request.params.id);
    return { success: true };
  });

  // Update price for an asset (manual price entry)
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof updatePriceSchema> }>(
    '/:id/price',
    async (request, reply) => {
      const validation = updatePriceSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const asset = await assetService.getById(request.params.id);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      await assetService.updatePrice(request.params.id, validation.data.price);
      const updatedAsset = await assetService.getById(request.params.id);

      return { asset: updatedAsset };
    }
  );

  // Set tags for asset
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof setTagsSchema> }>(
    '/:id/tags',
    async (request, reply) => {
      const validation = setTagsSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const asset = await assetService.getById(request.params.id);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      await assetService.setTags(request.params.id, validation.data.tagIds);
      const updatedAsset = await assetService.getWithTags(request.params.id);

      return { asset: updatedAsset };
    }
  );

  // Add tag to asset
  fastify.post<{ Params: { id: string; tagId: string } }>(
    '/:id/tags/:tagId',
    async (request, reply) => {
      const asset = await assetService.getById(request.params.id);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      await assetService.addTag(request.params.id, request.params.tagId);
      const updatedAsset = await assetService.getWithTags(request.params.id);

      return { asset: updatedAsset };
    }
  );

  // Remove tag from asset
  fastify.delete<{ Params: { id: string; tagId: string } }>(
    '/:id/tags/:tagId',
    async (request, reply) => {
      const asset = await assetService.getById(request.params.id);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      await assetService.removeTag(request.params.id, request.params.tagId);
      const updatedAsset = await assetService.getWithTags(request.params.id);

      return { asset: updatedAsset };
    }
  );

  // Bulk price update (manual entry when API is rate-limited)
  fastify.post<{
    Body: { prices: { symbol: string; price: number }[] };
  }>('/bulk-price-update', async (request, reply) => {
    const { prices } = request.body;
    if (!Array.isArray(prices)) {
      return reply.status(400).send({ error: 'prices must be an array' });
    }

    let updated = 0;
    const errors: { symbol: string; error: string }[] = [];

    for (const { symbol, price } of prices) {
      const asset = await assetService.getBySymbol(symbol);
      if (!asset) {
        errors.push({ symbol, error: 'Asset not found' });
        continue;
      }
      if (typeof price !== 'number' || price <= 0) {
        errors.push({ symbol, error: 'Invalid price' });
        continue;
      }
      await assetService.updatePrice(asset.id, price);
      updated++;
    }

    return { success: true, updated, errors };
  });

  // Apply stock split to an asset
  const splitSchema = z.object({
    ratio: z.number().positive().refine((v) => v !== 1, { message: 'Ratio must not be 1' }),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof splitSchema> }>(
    '/:id/split',
    async (request, reply) => {
      const validation = splitSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: validation.error.errors });
      }

      const asset = await assetService.getById(request.params.id);
      if (!asset) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      try {
        const result = await transactionService.applySplit(
          request.params.id,
          validation.data.ratio
        );
        return { success: true, symbol: asset.symbol, ratio: validation.data.ratio, ...result };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Migrate Indian stock symbols to include .NS suffix (direct database update, no API calls)
  fastify.post('/migrate-indian-stocks', async () => {
    const assets = await assetService.getAll();
    let migrated = 0;
    let skipped = 0;
    const updated: string[] = [];

    for (const asset of assets) {
      // Skip if already has .NS or .BO suffix
      if (asset.symbol.endsWith('.NS') || asset.symbol.endsWith('.BO')) {
        skipped++;
        continue;
      }

      // Skip non-yahoo_finance assets
      if (asset.provider !== 'yahoo_finance') {
        skipped++;
        continue;
      }

      // Add .NS suffix directly without API call
      const newSymbol = `${asset.symbol}.NS`;
      await assetService.updateSymbol(asset.id, newSymbol);
      await assetService.update(asset.id, { currency: 'INR' });
      updated.push(`${asset.symbol} → ${newSymbol}`);
      migrated++;
    }

    return {
      success: true,
      migrated,
      skipped,
      updated,
      message: 'Symbols updated. Run POST /api/market-data/refresh to fetch prices.',
    };
  });
}
