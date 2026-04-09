import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { hashSync, compareSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const JWT_SECRET = process.env.JWT_SECRET || 'money-matters-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

class AuthService {
  async register(email: string, password: string, name: string): Promise<{ user: { id: string; email: string; name: string }; tokens: AuthTokens }> {
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    if (existing.length > 0) {
      throw new Error('Email already registered');
    }

    const id = `user_${nanoid(12)}`;
    const passwordHash = hashSync(password, 10);
    const now = new Date();

    await db.insert(schema.users).values({
      id,
      email: email.toLowerCase(),
      name,
      passwordHash,
      createdAt: now,
    });

    await this.seedUserDefaults(id);

    const tokens = this.generateTokens({ userId: id, email: email.toLowerCase() });

    return {
      user: { id, email: email.toLowerCase(), name },
      tokens,
    };
  }

  async login(email: string, password: string): Promise<{ user: { id: string; email: string; name: string }; tokens: AuthTokens }> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const valid = compareSync(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload & { type: string };
      if (payload.type !== 'access') throw new Error('Invalid token type');
      return { userId: payload.userId, email: payload.email };
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  refreshAccessToken(refreshToken: string): AuthTokens {
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload & { type: string };
      if (payload.type !== 'refresh') throw new Error('Invalid token type');
      return this.generateTokens({ userId: payload.userId, email: payload.email });
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async getUser(userId: string) {
    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    }).from(schema.users).where(eq(schema.users.id, userId));
    return user ?? null;
  }

  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
  }

  private async seedUserDefaults(userId: string) {
    await db.insert(schema.appSettings).values({
      key: 'cycleStartDay', userId, value: '1',
    }).onConflictDoNothing();

    const now = new Date();
    const defaultCategories = [
      { name: 'Salary', type: 'income' as const, tag: null, sortOrder: 0 },
      { name: 'Other Income', type: 'income' as const, tag: null, sortOrder: 1 },
      { name: 'Discounts & Waivers', type: 'expense' as const, tag: 'need' as const, sortOrder: 99 },
    ];

    for (const cat of defaultCategories) {
      await db.insert(schema.cashFlowCategories).values({
        id: `cat_${cat.name.toLowerCase().replace(/\s+/g, '_')}_${userId}_${Date.now()}`,
        userId,
        name: cat.name,
        type: cat.type,
        tag: cat.tag,
        defaultBudget: 0,
        sortOrder: cat.sortOrder,
        createdAt: now,
      });
    }

    await db.insert(schema.paymentMethods).values({
      id: `pm_bank_${userId}_${Date.now()}`,
      userId,
      name: 'Bank Transfer',
      type: 'bank_transfer',
      isActive: true,
      createdAt: now,
    });
  }
}

export const authService = new AuthService();
