import { and, eq } from 'drizzle-orm';
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
  async getAll(userId: string): Promise<Tag[]> {
    return db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.userId, userId));
  },

  async getById(userId: string, id: string): Promise<Tag | undefined> {
    const results = await db
      .select()
      .from(schema.tags)
      .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)))
      .limit(1);
    return results[0];
  },

  async getByName(userId: string, name: string): Promise<Tag | undefined> {
    const results = await db
      .select()
      .from(schema.tags)
      .where(and(eq(schema.tags.name, name), eq(schema.tags.userId, userId)))
      .limit(1);
    return results[0];
  },

  async create(userId: string, input: CreateTagInput): Promise<Tag> {
    const now = new Date();
    const newTag: NewTag = {
      id: nanoid(),
      userId,
      name: input.name,
      color: input.color ?? '#6366f1',
      description: input.description ?? null,
      createdAt: now,
    };

    await db.insert(schema.tags).values(newTag);
    return newTag as Tag;
  },

  async update(
    userId: string,
    id: string,
    input: UpdateTagInput
  ): Promise<Tag | undefined> {
    const existing = await this.getById(userId, id);
    if (!existing) return undefined;

    const updates: Partial<Tag> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    if (input.description !== undefined) updates.description = input.description;

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.tags)
        .set(updates)
        .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)));
    }

    return this.getById(userId, id);
  },

  async delete(userId: string, id: string): Promise<boolean> {
    await db
      .delete(schema.tags)
      .where(and(eq(schema.tags.id, id), eq(schema.tags.userId, userId)));
    return true;
  },

  async getAssetsByTag(userId: string, tagId: string) {
    return db
      .select({ asset: schema.assets })
      .from(schema.assetTags)
      .innerJoin(schema.assets, eq(schema.assetTags.assetId, schema.assets.id))
      .innerJoin(schema.tags, eq(schema.assetTags.tagId, schema.tags.id))
      .where(
        and(eq(schema.assetTags.tagId, tagId), eq(schema.tags.userId, userId))
      );
  },

  async getTagsWithAssetCount(userId: string) {
    const tags = await this.getAll(userId);
    const counts = await Promise.all(
      tags.map(async (tag) => {
        const assets = await this.getAssetsByTag(userId, tag.id);
        return {
          ...tag,
          assetCount: assets.length,
        };
      })
    );
    return counts;
  },
};
