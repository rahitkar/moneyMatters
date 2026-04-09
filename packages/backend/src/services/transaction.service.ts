import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Transaction, NewTransaction, TransactionType, RealizedGain } from '../db/schema.js';

export interface CreateTransactionInput {
  userId: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees?: number;
  fundSourceId?: string;
  transactionDate: string;
  notes?: string;
}

export interface TransactionWithAsset extends Transaction {
  asset: {
    symbol: string;
    name: string;
    assetClass: string;
    currency: string;
  };
  fundSource?: {
    id: string;
    name: string;
    symbol: string;
  } | null;
}

export interface Position {
  assetId: string;
  symbol: string;
  name: string;
  assetClass: string;
  currency: string;
  quantity: number;
  averageCost: number;
  totalCost: number;
  currentPrice: number | null;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  realizedGain: number;
  lastActivityDate: string | null;
}

export interface LotInfo {
  transactionId: string;
  quantity: number;
  remainingQuantity: number;
  price: number;
  date: string;
}

export const transactionService = {
  async getAll(userId: string): Promise<Transaction[]> {
    const results = await db
      .select({ transaction: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId))
      .orderBy(desc(schema.transactions.transactionDate));
    return results.map((r) => r.transaction);
  },

  async getAllWithAssets(userId: string): Promise<TransactionWithAsset[]> {
    const results = await db
      .select({
        transaction: schema.transactions,
        asset: {
          symbol: schema.assets.symbol,
          name: schema.assets.name,
          assetClass: schema.assets.assetClass,
          currency: schema.assets.currency,
        },
      })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId))
      .orderBy(desc(schema.transactions.transactionDate));
    const fundSourceIds = [...new Set(results.map((r) => r.transaction.fundSourceId).filter(Boolean))] as string[];
    const fundSourceMap = new Map<string, { id: string; name: string; symbol: string }>();
    if (fundSourceIds.length > 0) {
      const fsAssets = await db
        .select({ id: schema.assets.id, name: schema.assets.name, symbol: schema.assets.symbol })
        .from(schema.assets)
        .where(
          and(
            eq(schema.assets.userId, userId),
            sql`${schema.assets.id} IN (${sql.join(fundSourceIds.map((id) => sql`${id}`), sql`, `)})`
          )
        );
      for (const a of fsAssets) fundSourceMap.set(a.id, a);
    }

    return results.map((r) => ({
      ...r.transaction,
      asset: { ...r.asset, currency: r.asset.currency ?? 'INR' },
      fundSource: r.transaction.fundSourceId ? (fundSourceMap.get(r.transaction.fundSourceId) ?? null) : null,
    }));
  },

  async getById(userId: string, id: string): Promise<Transaction | undefined> {
    const results = await db
      .select({ transaction: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(and(eq(schema.transactions.id, id), eq(schema.assets.userId, userId)))
      .limit(1);
    return results[0]?.transaction;
  },

  async getByAssetId(_userId: string, assetId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.assetId, assetId))
      .orderBy(asc(schema.transactions.transactionDate));
  },

  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    if (input.userId !== userId) {
      throw new Error('User mismatch');
    }

    const [ownedAsset] = await db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(and(eq(schema.assets.id, input.assetId), eq(schema.assets.userId, userId)))
      .limit(1);
    if (!ownedAsset) {
      throw new Error('Asset not found or access denied');
    }

    if (input.fundSourceId) {
      const [fundSrc] = await db
        .select({ id: schema.assets.id })
        .from(schema.assets)
        .where(and(eq(schema.assets.id, input.fundSourceId), eq(schema.assets.userId, userId)))
        .limit(1);
      if (!fundSrc) {
        throw new Error('Fund source not found or access denied');
      }
    }

    const now = new Date();

    if (input.type === 'sell') {
      const position = await this.getPositionForAsset(userId, input.assetId);
      if (!position || position.quantity < input.quantity) {
        throw new Error(
          `Insufficient quantity. Available: ${position?.quantity ?? 0}, Requested: ${input.quantity}`
        );
      }
    }

    const newTransaction: NewTransaction = {
      id: nanoid(),
      assetId: input.assetId,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      fees: input.fees ?? 0,
      fundSourceId: input.fundSourceId ?? null,
      transactionDate: input.transactionDate,
      notes: input.notes ?? null,
      createdAt: now,
    };

    await db.insert(schema.transactions).values(newTransaction);

    if (input.type === 'sell') {
      await this.processFIFOSale(
        userId,
        newTransaction.id,
        input.assetId,
        input.quantity,
        input.price,
        input.transactionDate
      );
    }

    return newTransaction as Transaction;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const transaction = await this.getById(userId, id);
    if (!transaction) return false;

    await db.delete(schema.realizedGains).where(eq(schema.realizedGains.sellTransactionId, id));

    await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
    return true;
  },

  async processFIFOSale(
    _userId: string,
    sellTransactionId: string,
    assetId: string,
    sellQuantity: number,
    sellPrice: number,
    sellDate: string
  ): Promise<void> {
    const buyTransactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'buy')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate));
    const existingGains = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId));
    const lotRemaining = new Map<string, number>();
    for (const buy of buyTransactions) {
      lotRemaining.set(buy.id, buy.quantity);
    }

    for (const gain of existingGains) {
      const current = lotRemaining.get(gain.buyTransactionId) ?? 0;
      lotRemaining.set(gain.buyTransactionId, current - gain.quantity);
    }

    let remainingToSell = sellQuantity;
    const now = new Date();

    for (const buy of buyTransactions) {
      if (remainingToSell <= 0) break;

      const availableInLot = lotRemaining.get(buy.id) ?? 0;
      if (availableInLot <= 0) continue;

      const quantityFromThisLot = Math.min(remainingToSell, availableInLot);
      const costBasis = quantityFromThisLot * buy.price;
      const saleProceeds = quantityFromThisLot * sellPrice;
      const gain = saleProceeds - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

      await db.insert(schema.realizedGains).values({
        id: nanoid(),
        assetId,
        sellTransactionId,
        buyTransactionId: buy.id,
        quantity: quantityFromThisLot,
        costBasis,
        saleProceeds,
        gain,
        gainPercent,
        realizedDate: sellDate,
        createdAt: now,
      });

      remainingToSell -= quantityFromThisLot;
    }
  },

  async getPositionForAsset(userId: string, assetId: string): Promise<Position | null> {
    const asset = await db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.id, assetId), eq(schema.assets.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!asset) return null;

    const transactions = await this.getByAssetId(userId, assetId);
    const realizedGainsData = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId));
    let totalQuantity = 0;
    let totalCost = 0;
    let totalRealizedGain = 0;

    const lotRemaining = new Map<string, { quantity: number; price: number }>();

    for (const tx of transactions) {
      if (tx.type === 'buy') {
        lotRemaining.set(tx.id, { quantity: tx.quantity, price: tx.price });
        totalQuantity += tx.quantity;
        totalCost += tx.quantity * tx.price + (tx.fees ?? 0);
      } else {
        totalQuantity -= tx.quantity;
      }
    }

    const fundSourceTx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.fundSourceId, assetId));
    for (const tx of fundSourceTx) {
      const amount = tx.quantity * tx.price + (tx.fees ?? 0);
      if (tx.type === 'buy') {
        totalQuantity -= amount;
        totalCost -= amount;
      } else {
        totalQuantity += (tx.quantity * tx.price - (tx.fees ?? 0));
        totalCost += (tx.quantity * tx.price - (tx.fees ?? 0));
      }
    }

    for (const gain of realizedGainsData) {
      const lot = lotRemaining.get(gain.buyTransactionId);
      if (lot) {
        lot.quantity -= gain.quantity;
        totalCost -= gain.costBasis;
      }
      totalRealizedGain += gain.gain;
    }

    let positionCost = 0;
    for (const [, lot] of lotRemaining) {
      if (lot.quantity > 0) {
        positionCost += lot.quantity * lot.price;
      }
    }

    const isCashLike = ['cash', 'lended', 'fixed_deposit', 'ppf', 'epf'].includes(asset.assetClass);
    const currentPrice = isCashLike ? 1 : (asset.currentPrice ?? 0);
    const effectiveQuantity = isCashLike ? totalQuantity : Math.max(0, totalQuantity);
    const currentValue = effectiveQuantity * currentPrice;
    const unrealizedGain = isCashLike ? 0 : (currentValue - positionCost);
    const unrealizedGainPercent = positionCost > 0 && !isCashLike ? (unrealizedGain / positionCost) * 100 : 0;
    const averageCost = effectiveQuantity > 0 ? positionCost / effectiveQuantity : 0;

    let lastActivityDate: string | null = null;
    if (asset.provider === 'manual') {
      const lastTx = await db
        .select({ d: sql<string>`MAX(transaction_date)` })
        .from(schema.transactions)
        .where(eq(schema.transactions.assetId, assetId))
        .then((r) => r[0]?.d ?? null);
      lastActivityDate = lastTx;
    } else {
      const lastPrice = await db
        .select({ ts: sql<string>`MAX(recorded_at)` })
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.assetId, assetId))
        .then((r) => r[0]?.ts ?? null);
      if (lastPrice) {
        lastActivityDate = new Date(lastPrice).toISOString();
      } else if (asset.lastUpdated) {
        lastActivityDate = new Date(asset.lastUpdated.getTime()).toISOString();
      }
    }

    return {
      assetId,
      symbol: asset.symbol,
      name: asset.name,
      assetClass: asset.assetClass,
      currency: asset.currency || 'USD',
      quantity: effectiveQuantity,
      averageCost: isCashLike ? 1 : averageCost,
      totalCost: isCashLike ? effectiveQuantity : positionCost,
      currentPrice,
      currentValue,
      unrealizedGain,
      unrealizedGainPercent,
      realizedGain: totalRealizedGain,
      lastActivityDate,
    };
  },

  async getAllPositions(userId: string): Promise<Position[]> {
    const assets = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.userId, userId));
    const positions: Position[] = [];

    for (const asset of assets) {
      const position = await this.getPositionForAsset(userId, asset.id);
      if (position && position.quantity > 0) {
        positions.push(position);
      }
    }

    return positions;
  },

  async getBuyLots(_userId: string, assetId: string): Promise<LotInfo[]> {
    const buyTransactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'buy')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate));
    const realizedGainsData = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId));
    const soldFromLot = new Map<string, number>();
    for (const gain of realizedGainsData) {
      const current = soldFromLot.get(gain.buyTransactionId) ?? 0;
      soldFromLot.set(gain.buyTransactionId, current + gain.quantity);
    }

    return buyTransactions.map((tx) => ({
      transactionId: tx.id,
      quantity: tx.quantity,
      remainingQuantity: tx.quantity - (soldFromLot.get(tx.id) ?? 0),
      price: tx.price,
      date: tx.transactionDate,
    }));
  },

  async getTotalRealizedGains(userId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.realizedGains.gain}), 0)` })
      .from(schema.realizedGains)
      .innerJoin(schema.assets, eq(schema.realizedGains.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId));
    return result[0]?.total ?? 0;
  },

  async getRealizedGainsByAsset(userId: string, assetId: string): Promise<RealizedGain[]> {
    const rows = await db
      .select({ rg: schema.realizedGains })
      .from(schema.realizedGains)
      .innerJoin(schema.assets, eq(schema.realizedGains.assetId, schema.assets.id))
      .where(and(eq(schema.realizedGains.assetId, assetId), eq(schema.assets.userId, userId)))
      .orderBy(desc(schema.realizedGains.realizedDate));
    return rows.map((r) => r.rg);
  },

  async applySplit(userId: string, assetId: string, ratio: number): Promise<{ adjustedCount: number }> {
    const allTx = await this.getByAssetId(userId, assetId);
    if (allTx.length === 0) throw new Error('No transactions found for this asset');

    for (const tx of allTx) {
      await db
        .update(schema.transactions)
        .set({
          quantity: tx.quantity * ratio,
          price: tx.price / ratio,
        })
        .where(eq(schema.transactions.id, tx.id));
    }

    await db
      .update(schema.priceHistory)
      .set({ price: sql`price / ${ratio}` })
      .where(eq(schema.priceHistory.assetId, assetId));

    await db.delete(schema.realizedGains).where(eq(schema.realizedGains.assetId, assetId));

    const sellTx = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'sell')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate));
    for (const sell of sellTx) {
      await this.processFIFOSale(
        userId,
        sell.id,
        assetId,
        sell.quantity,
        sell.price,
        sell.transactionDate
      );
    }

    return { adjustedCount: allTx.length };
  },

  async rebuildRealizedGainsForAsset(userId: string, assetId: string): Promise<void> {
    await db.delete(schema.realizedGains).where(eq(schema.realizedGains.assetId, assetId));

    const sellTx = await db
      .select()
      .from(schema.transactions)
      .where(
        and(eq(schema.transactions.assetId, assetId), eq(schema.transactions.type, 'sell'))
      )
      .orderBy(asc(schema.transactions.transactionDate));
    for (const sell of sellTx) {
      await this.processFIFOSale(
        userId,
        sell.id,
        assetId,
        sell.quantity,
        sell.price,
        sell.transactionDate
      );
    }
  },
};
