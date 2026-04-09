import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Asset, NewAsset, AssetClass, Provider } from '../db/schema.js';

export interface CreateAssetInput {
  userId: string;
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
  async getAll(userId: string): Promise<Asset[]> {
    return db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.userId, userId));
  },

  async getAllWithTags(userId: string) {
    const assets = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.userId, userId));
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

  async getById(userId: string, id: string): Promise<Asset | undefined> {
    const results = await db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, userId)))
      .limit(1);
    return results[0];
  },

  async getBySymbol(userId: string, symbol: string): Promise<Asset | undefined> {
    const results = await db
      .select()
      .from(schema.assets)
      .where(
        and(eq(schema.assets.symbol, symbol.toUpperCase()), eq(schema.assets.userId, userId))
      )
      .limit(1);
    return results[0];
  },

  async getByIsin(userId: string, isin: string): Promise<Asset | undefined> {
    const i = isin.trim().toUpperCase();
    if (!i) return undefined;
    const results = await db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.isin, i), eq(schema.assets.userId, userId)))
      .limit(1);
    return results[0];
  },

  async getByAssetClass(userId: string, assetClass: AssetClass): Promise<Asset[]> {
    return db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.assetClass, assetClass), eq(schema.assets.userId, userId)));
  },

  async create(input: CreateAssetInput): Promise<Asset> {
    const now = new Date();
    const newAsset: NewAsset = {
      id: nanoid(),
      userId: input.userId,
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

  async update(
    userId: string,
    id: string,
    input: UpdateAssetInput
  ): Promise<Asset | undefined> {
    const existing = await this.getById(userId, id);
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
        .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, userId)));
    }

    return this.getById(userId, id);
  },

  async updateSymbol(userId: string, id: string, newSymbol: string): Promise<Asset | undefined> {
    const existing = await this.getById(userId, id);
    if (!existing) return undefined;

    await db
      .update(schema.assets)
      .set({ symbol: newSymbol.toUpperCase() })
      .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, userId)));

    return this.getById(userId, id);
  },

  async updatePrice(
    id: string,
    price: number,
    marketTime?: Date,
    previousClose?: number,
    userId?: string
  ): Promise<void> {
    const assetWhere =
      userId != null
        ? and(eq(schema.assets.id, id), eq(schema.assets.userId, userId))
        : eq(schema.assets.id, id);

    const assetExists = await db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(assetWhere)
      .limit(1)
      .then((r) => r[0]);
    if (!assetExists) return;

    const now = new Date();
    // Yahoo returns regularMarketTime for US/IN equities & ETFs; invalid/missing → fetch time
    const quoteTime =
      marketTime != null && !Number.isNaN(marketTime.getTime()) ? marketTime : undefined;

    const updates: Record<string, unknown> = { currentPrice: price, lastUpdated: now };
    if (previousClose != null) updates.previousClose = previousClose;

    await db.update(schema.assets).set(updates).where(assetWhere);

    const lastEntry = await db
      .select({
        id: schema.priceHistory.id,
        price: schema.priceHistory.price,
        recordedAt: schema.priceHistory.recordedAt,
      })
      .from(schema.priceHistory)
      .where(eq(schema.priceHistory.assetId, id))
      .orderBy(desc(schema.priceHistory.recordedAt))
      .limit(1)
      .then((r) => r[0] ?? null);

    const ts = quoteTime ?? now;
    const round4 = (v: number) => Math.round(v * 10000) / 10000;

    if (quoteTime && lastEntry) {
      const lastTs = lastEntry.recordedAt instanceof Date
        ? lastEntry.recordedAt.getTime()
        : Number(lastEntry.recordedAt) * 1000;

      // Same market session (within 1 min) → skip
      if (Math.abs(ts.getTime() - lastTs) < 60_000) return;

      // Market time is BEFORE the last recorded_at → previous entry was a phantom
      // (fetched when market was closed). Correct its timestamp.
      if (ts.getTime() < lastTs) {
        await db
          .update(schema.priceHistory)
          .set({ recordedAt: ts, price })
          .where(eq(schema.priceHistory.id, lastEntry.id));
        return;
      }
    }

    if (!lastEntry || round4(lastEntry.price) !== round4(price)) {
      await db.insert(schema.priceHistory).values({
        id: nanoid(),
        assetId: id,
        price,
        recordedAt: ts,
      });
    }
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.getById(userId, id);
    if (!existing) return false;

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
    await db
      .delete(schema.assets)
      .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, userId)));
    return true;
  },

  async getWithTags(userId: string, id: string) {
    const asset = await this.getById(userId, id);
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
        and(eq(schema.assetTags.assetId, assetId), eq(schema.assetTags.tagId, tagId))
      );
  },

  async setTags(assetId: string, tagIds: string[]): Promise<void> {
    await db.delete(schema.assetTags).where(eq(schema.assetTags.assetId, assetId));

    if (tagIds.length > 0) {
      await db.insert(schema.assetTags).values(
        tagIds.map((tagId) => ({ assetId, tagId }))
      );
    }
  },

  async bulkAddTags(assetIds: string[], tagIds: string[]): Promise<number> {
    if (!assetIds.length || !tagIds.length) return 0;

    const rows = assetIds.flatMap((assetId) =>
      tagIds.map((tagId) => ({ assetId, tagId }))
    );
    await db.insert(schema.assetTags).values(rows).onConflictDoNothing();
    return rows.length;
  },

  async bulkRemoveTags(assetIds: string[], tagIds: string[]): Promise<number> {
    if (!assetIds.length || !tagIds.length) return 0;

    let removed = 0;
    for (const assetId of assetIds) {
      for (const tagId of tagIds) {
        await db
          .delete(schema.assetTags)
          .where(and(eq(schema.assetTags.assetId, assetId), eq(schema.assetTags.tagId, tagId)));
        removed++;
      }
    }
    return removed;
  },
};
