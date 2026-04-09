import { eq, getTableColumns } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Holding, NewHolding } from '../db/schema.js';

export interface CreateHoldingInput {
  assetId: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string;
}

export interface UpdateHoldingInput {
  quantity?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  notes?: string;
}

export const holdingService = {
  async getAll(userId: string): Promise<Holding[]> {
    return db
      .select(getTableColumns(schema.holdings))
      .from(schema.holdings)
      .innerJoin(schema.assets, eq(schema.holdings.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId));
  },

  async getById(_userId: string, id: string): Promise<Holding | undefined> {
    const results = await db
      .select()
      .from(schema.holdings)
      .where(eq(schema.holdings.id, id))
      .limit(1);
    return results[0];
  },

  async getByAssetId(_userId: string, assetId: string): Promise<Holding[]> {
    return db
      .select()
      .from(schema.holdings)
      .where(eq(schema.holdings.assetId, assetId));
  },

  async getAllWithAssets(userId: string) {
    return db
      .select({
        holding: schema.holdings,
        asset: schema.assets,
      })
      .from(schema.holdings)
      .innerJoin(schema.assets, eq(schema.holdings.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId));
  },

  async create(_userId: string, input: CreateHoldingInput): Promise<Holding> {
    const now = new Date();
    const newHolding: NewHolding = {
      id: nanoid(),
      assetId: input.assetId,
      quantity: input.quantity,
      purchasePrice: input.purchasePrice,
      purchaseDate: input.purchaseDate,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.holdings).values(newHolding);
    return newHolding as Holding;
  },

  async update(userId: string, id: string, input: UpdateHoldingInput): Promise<Holding | undefined> {
    const existing = await this.getById(userId, id);
    if (!existing) return undefined;

    const updates: Partial<Holding> = {
      updatedAt: new Date(),
    };

    if (input.quantity !== undefined) updates.quantity = input.quantity;
    if (input.purchasePrice !== undefined) updates.purchasePrice = input.purchasePrice;
    if (input.purchaseDate !== undefined) updates.purchaseDate = input.purchaseDate;
    if (input.notes !== undefined) updates.notes = input.notes;

    await db.update(schema.holdings).set(updates).where(eq(schema.holdings.id, id));

    return this.getById(userId, id);
  },

  async delete(_userId: string, id: string): Promise<boolean> {
    await db.delete(schema.holdings).where(eq(schema.holdings.id, id));
    return true;
  },

  async deleteByAssetId(_userId: string, assetId: string): Promise<void> {
    await db.delete(schema.holdings).where(eq(schema.holdings.assetId, assetId));
  },
};
