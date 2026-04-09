import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq, and } from 'drizzle-orm';
import * as schema from './schema.js';
import { hashSync } from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const client = postgres(DATABASE_URL);
export const db = drizzle(client, { schema });

export const DEFAULT_USER_ID = 'user_default';

export async function initializeDatabase() {
  await seedDefaultUser();
  await seedBenchmarks();
  await seedDefaultCategories();
  console.log('Database initialized successfully');
}

async function seedDefaultUser() {
  const existing = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, DEFAULT_USER_ID));

  if (existing.length > 0) return;

  const defaultHash = hashSync('admin123', 10);
  await db.insert(schema.users).values({
    id: DEFAULT_USER_ID,
    email: 'admin@moneymatters.local',
    name: 'Admin',
    passwordHash: defaultHash,
    createdAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(schema.appSettings).values([
    { key: 'cycleStartDay', userId: DEFAULT_USER_ID, value: '1' },
    { key: 'dob', userId: DEFAULT_USER_ID, value: '1998-09-09' },
  ]).onConflictDoNothing();
}

async function seedDefaultCategories() {
  const defaults = [
    { name: 'Discounts & Waivers', type: 'expense' as const, tag: 'need' as const, sortOrder: 99 },
  ];

  const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
  if (allUsers.length === 0) return;

  for (const user of allUsers) {
    for (const cat of defaults) {
      const existing = await db.select({ id: schema.cashFlowCategories.id })
        .from(schema.cashFlowCategories)
        .where(
          and(
            eq(schema.cashFlowCategories.name, cat.name),
            eq(schema.cashFlowCategories.type, cat.type),
            eq(schema.cashFlowCategories.userId, user.id),
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.cashFlowCategories).values({
          id: `cat_${cat.name.toLowerCase().replace(/\s+/g, '_')}_${user.id}_${Date.now()}`,
          userId: user.id,
          name: cat.name,
          type: cat.type,
          tag: cat.tag,
          defaultBudget: 0,
          sortOrder: cat.sortOrder,
          createdAt: new Date(),
        });
      }
    }
  }
}

async function seedBenchmarks() {
  const defaultBenchmarks = [
    { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
    { symbol: '^IXIC', name: 'NASDAQ Composite', region: 'US' },
    { symbol: '^DJI', name: 'Dow Jones Industrial Average', region: 'US' },
    { symbol: '^FTSE', name: 'FTSE 100', region: 'UK' },
    { symbol: '^N225', name: 'Nikkei 225', region: 'Japan' },
    { symbol: '^GDAXI', name: 'DAX', region: 'Germany' },
    { symbol: '^NSEI', name: 'Nifty 50', region: 'India' },
    { symbol: '^BSESN', name: 'BSE Sensex', region: 'India' },
    { symbol: 'NIFTYMIDCAP150.NS', name: 'Nifty Midcap 150', region: 'India' },
    { symbol: 'HDFCSML250.NS', name: 'Nifty Smallcap 250', region: 'India' },
  ];

  for (const bm of defaultBenchmarks) {
    await db.insert(schema.benchmarks).values({
      id: `benchmark_${bm.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`,
      symbol: bm.symbol,
      name: bm.name,
      region: bm.region,
      isActive: true,
      createdAt: new Date(),
    }).onConflictDoNothing();
  }
}

export { schema };
