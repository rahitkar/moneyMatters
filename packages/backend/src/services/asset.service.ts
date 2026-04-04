import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Asset, NewAsset, AssetClass, Provider } from '../db/schema.js';

export interface CreateAssetInput {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  provider: Provider;
  currentPrice?: number;
  currency?: string;
  /** Mutual fund ISIN (INF…) when known */
  isin?: string | null;
  interestRate?: number | null;
  maturityDate?: string | null;
  institution?: string | null;
}

export interface UpdateAssetInput {
  name?: string;
  assetClass?: AssetClass;
  currentPrice?: number;
  currency?: string;
  isin?: string | null;
  interestRate?: number | null;
  maturityDate?: string | null;
  institution?: string | null;
}

export const assetService = {
  async getAll(): Promise<Asset[]> {
    return db.select().from(schema.assets).all();
  },

  async getAllWithTags() {
    const assets = await db.select().from(schema.assets).all();
    const allAssetTags = await db
      .select({ assetId: schema.assetTags.assetId, tag: schema.tags })
      .from(schema.assetTags)
      .innerJoin(schema.tags, eq(schema.assetTags.tagId, schema.tags.id));

    const tagsByAsset = new Map<string, (typeof allAssetTags)[number]['tag'][]>();
    for (const row of allAssetTags) {
      const list = tagsByAsset.get(row.assetId) ?? [];
      list.push(row.tag);
      tagsByAsset.set(row.assetId, list);
    }

    return assets.map((asset) => ({
      ...asset,
      tags: tagsByAsset.get(asset.id) ?? [],
    }));
  },

  async getById(id: string): Promise<Asset | undefined> {
    const results = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.id, id))
      .limit(1);
    return results[0];
  },

  async getBySymbol(symbol: string): Promise<Asset | undefined> {
    const results = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.symbol, symbol.toUpperCase()))
      .limit(1);
    return results[0];
  },

  async getByIsin(isin: string): Promise<Asset | undefined> {
    const i = isin.trim().toUpperCase();
    if (!i) return undefined;
    const results = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.isin, i))
      .limit(1);
    return results[0];
  },

  async getByAssetClass(assetClass: AssetClass): Promise<Asset[]> {
    return db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.assetClass, assetClass))
      .all();
  },

  async create(input: CreateAssetInput): Promise<Asset> {
    const now = new Date();
    const newAsset: NewAsset = {
      id: nanoid(),
      symbol: input.symbol.toUpperCase(),
      isin: input.isin?.trim().toUpperCase() ?? null,
      name: input.name,
      assetClass: input.assetClass,
      provider: input.provider,
      currentPrice: input.currentPrice ?? null,
      currency: input.currency ?? 'USD',
      lastUpdated: input.currentPrice ? now : null,
      createdAt: now,
      interestRate: input.interestRate ?? null,
      maturityDate: input.maturityDate ?? null,
      institution: input.institution ?? null,
    };

    await db.insert(schema.assets).values(newAsset);
    return newAsset as Asset;
  },

  async update(id: string, input: UpdateAssetInput): Promise<Asset | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const updates: Partial<Asset> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.assetClass !== undefined) updates.assetClass = input.assetClass;
    if (input.currentPrice !== undefined) {
      updates.currentPrice = input.currentPrice;
      updates.lastUpdated = new Date();
    }
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.isin !== undefined) {
      updates.isin = input.isin?.trim().toUpperCase() ?? null;
    }
    if (input.interestRate !== undefined) updates.interestRate = input.interestRate;
    if (input.maturityDate !== undefined) updates.maturityDate = input.maturityDate;
    if (input.institution !== undefined) updates.institution = input.institution;

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.assets)
        .set(updates)
        .where(eq(schema.assets.id, id));
    }

    return this.getById(id);
  },

  async updateSymbol(id: string, newSymbol: string): Promise<Asset | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    await db
      .update(schema.assets)
      .set({ symbol: newSymbol.toUpperCase() })
      .where(eq(schema.assets.id, id));

    return this.getById(id);
  },

  async updatePrice(id: string, price: number): Promise<void> {
    const now = new Date();
    await db
      .update(schema.assets)
      .set({ currentPrice: price, lastUpdated: now })
      .where(eq(schema.assets.id, id));

    // Record price history
    await db.insert(schema.priceHistory).values({
      id: nanoid(),
      assetId: id,
      price,
      recordedAt: now,
    });
  },

  async delete(id: string): Promise<boolean> {
    // Delete related data first (cascade manually since SQLite foreign keys might not work)
    // Delete realized gains for this asset
    await db.delete(schema.realizedGains).where(eq(schema.realizedGains.assetId, id));
    
    // Delete transactions for this asset
    await db.delete(schema.transactions).where(eq(schema.transactions.assetId, id));
    
    // Delete holdings for this asset
    await db.delete(schema.holdings).where(eq(schema.holdings.assetId, id));
    
    // Delete asset tags
    await db.delete(schema.assetTags).where(eq(schema.assetTags.assetId, id));
    
    // Delete price history
    await db.delete(schema.priceHistory).where(eq(schema.priceHistory.assetId, id));
    
    // Finally delete the asset
    await db.delete(schema.assets).where(eq(schema.assets.id, id));
    return true;
  },

  async getWithTags(id: string) {
    const asset = await this.getById(id);
    if (!asset) return undefined;

    const tagResults = await db
      .select({ tag: schema.tags })
      .from(schema.assetTags)
      .innerJoin(schema.tags, eq(schema.assetTags.tagId, schema.tags.id))
      .where(eq(schema.assetTags.assetId, id));

    return {
      ...asset,
      tags: tagResults.map((r) => r.tag),
    };
  },

  async addTag(assetId: string, tagId: string): Promise<void> {
    await db.insert(schema.assetTags).values({ assetId, tagId }).onConflictDoNothing();
  },

  async removeTag(assetId: string, tagId: string): Promise<void> {
    await db
      .delete(schema.assetTags)
      .where(
        eq(schema.assetTags.assetId, assetId) 
      );
  },

  async setTags(assetId: string, tagIds: string[]): Promise<void> {
    // Remove all existing tags
    await db.delete(schema.assetTags).where(eq(schema.assetTags.assetId, assetId));

    // Add new tags
    if (tagIds.length > 0) {
      await db.insert(schema.assetTags).values(
        tagIds.map((tagId) => ({ assetId, tagId }))
      );
    }
  },
};
