import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Tag, NewTag } from '../db/schema.js';

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  description?: string;
}

export const tagService = {
  async getAll(): Promise<Tag[]> {
    return db.select().from(schema.tags).all();
  },

  async getById(id: string): Promise<Tag | undefined> {
    const results = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.id, id))
      .limit(1);
    return results[0];
  },

  async getByName(name: string): Promise<Tag | undefined> {
    const results = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.name, name))
      .limit(1);
    return results[0];
  },

  async create(input: CreateTagInput): Promise<Tag> {
    const now = new Date();
    const newTag: NewTag = {
      id: nanoid(),
      name: input.name,
      color: input.color ?? '#6366f1',
      description: input.description ?? null,
      createdAt: now,
    };

    await db.insert(schema.tags).values(newTag);
    return newTag as Tag;
  },

  async update(id: string, input: UpdateTagInput): Promise<Tag | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const updates: Partial<Tag> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    if (input.description !== undefined) updates.description = input.description;

    if (Object.keys(updates).length > 0) {
      await db.update(schema.tags).set(updates).where(eq(schema.tags.id, id));
    }

    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
    return true;
  },

  async getAssetsByTag(tagId: string) {
    return db
      .select({ asset: schema.assets })
      .from(schema.assetTags)
      .innerJoin(schema.assets, eq(schema.assetTags.assetId, schema.assets.id))
      .where(eq(schema.assetTags.tagId, tagId))
      .all();
  },

  async getTagsWithAssetCount() {
    const tags = await this.getAll();
    const counts = await Promise.all(
      tags.map(async (tag) => {
        const assets = await this.getAssetsByTag(tag.id);
        return {
          ...tag,
          assetCount: assets.length,
        };
      })
    );
    return counts;
  },
};
