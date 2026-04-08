import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { Transaction, NewTransaction, TransactionType, RealizedGain } from '../db/schema.js';

export interface CreateTransactionInput {
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
  async getAll(): Promise<Transaction[]> {
    return db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.transactionDate))
      .all();
  },

  async getAllWithAssets(): Promise<TransactionWithAsset[]> {
    // Drizzle doesn't easily support self-joins with aliases, so do a two-step approach
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
      .orderBy(desc(schema.transactions.transactionDate))
      .all();

    // Batch-load fund source names
    const fundSourceIds = [...new Set(results.map((r) => r.transaction.fundSourceId).filter(Boolean))] as string[];
    const fundSourceMap = new Map<string, { id: string; name: string; symbol: string }>();
    if (fundSourceIds.length > 0) {
      const fsAssets = await db.select({ id: schema.assets.id, name: schema.assets.name, symbol: schema.assets.symbol })
        .from(schema.assets)
        .where(sql`${schema.assets.id} IN (${sql.join(fundSourceIds.map((id) => sql`${id}`), sql`, `)})`)
        .all();
      for (const a of fsAssets) fundSourceMap.set(a.id, a);
    }

    return results.map((r) => ({
      ...r.transaction,
      asset: { ...r.asset, currency: r.asset.currency ?? 'INR' },
      fundSource: r.transaction.fundSourceId ? (fundSourceMap.get(r.transaction.fundSourceId) ?? null) : null,
    }));
  },

  async getById(id: string): Promise<Transaction | undefined> {
    const results = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .limit(1);
    return results[0];
  },

  async getByAssetId(assetId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.assetId, assetId))
      .orderBy(asc(schema.transactions.transactionDate))
      .all();
  },

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const now = new Date();

    // For sell transactions, validate we have enough quantity
    if (input.type === 'sell') {
      const position = await this.getPositionForAsset(input.assetId);
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

    // For sell transactions, process FIFO matching
    if (input.type === 'sell') {
      await this.processFIFOSale(
        newTransaction.id,
        input.assetId,
        input.quantity,
        input.price,
        input.transactionDate
      );
    }

    return newTransaction as Transaction;
  },

  async delete(id: string): Promise<boolean> {
    const transaction = await this.getById(id);
    if (!transaction) return false;

    // Delete associated realized gains
    await db
      .delete(schema.realizedGains)
      .where(eq(schema.realizedGains.sellTransactionId, id));

    await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
    return true;
  },

  // FIFO cost basis matching for sales
  async processFIFOSale(
    sellTransactionId: string,
    assetId: string,
    sellQuantity: number,
    sellPrice: number,
    sellDate: string
  ): Promise<void> {
    // Get all buy transactions for this asset, ordered by date (oldest first)
    const buyTransactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'buy')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate))
      .all();

    // Get existing realized gains to know what's already been sold
    const existingGains = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId))
      .all();

    // Calculate remaining quantity for each buy lot
    const lotRemaining = new Map<string, number>();
    for (const buy of buyTransactions) {
      lotRemaining.set(buy.id, buy.quantity);
    }

    // Subtract already sold quantities
    for (const gain of existingGains) {
      const current = lotRemaining.get(gain.buyTransactionId) ?? 0;
      lotRemaining.set(gain.buyTransactionId, current - gain.quantity);
    }

    // Match sell against oldest buy lots (FIFO)
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

  // Get current position for an asset (computed from transactions)
  async getPositionForAsset(assetId: string): Promise<Position | null> {
    const asset = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.id, assetId))
      .limit(1)
      .then((r) => r[0]);

    if (!asset) return null;

    const transactions = await this.getByAssetId(assetId);
    const realizedGainsData = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId))
      .all();

    // Calculate position using FIFO
    let totalQuantity = 0;
    let totalCost = 0;
    let totalRealizedGain = 0;

    // Track remaining quantity in each buy lot
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

    // Fund-source adjustments: other transactions that reference this asset as fundSource
    const fundSourceTx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.fundSourceId, assetId))
      .all();

    for (const tx of fundSourceTx) {
      const amount = tx.quantity * tx.price + (tx.fees ?? 0);
      if (tx.type === 'buy') {
        // Money LEFT this account to fund a buy elsewhere
        totalQuantity -= amount;
        totalCost -= amount;
      } else {
        // Money CAME TO this account as proceeds from a sell elsewhere
        totalQuantity += (tx.quantity * tx.price - (tx.fees ?? 0));
        totalCost += (tx.quantity * tx.price - (tx.fees ?? 0));
      }
    }

    // Subtract sold quantities and calculate realized gains
    for (const gain of realizedGainsData) {
      const lot = lotRemaining.get(gain.buyTransactionId);
      if (lot) {
        lot.quantity -= gain.quantity;
        totalCost -= gain.costBasis;
      }
      totalRealizedGain += gain.gain;
    }

    // Current position cost is sum of remaining lots
    let positionCost = 0;
    for (const [, lot] of lotRemaining) {
      if (lot.quantity > 0) {
        positionCost += lot.quantity * lot.price;
      }
    }

    // For cash/wallet assets, position cost = quantity (1:1 value)
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
        .select({ ts: sql<number>`MAX(recorded_at)` })
        .from(schema.priceHistory)
        .where(eq(schema.priceHistory.assetId, assetId))
        .then((r) => r[0]?.ts ?? null);
      if (lastPrice) {
        lastActivityDate = new Date(lastPrice * 1000).toISOString();
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

  // Get all current positions
  async getAllPositions(): Promise<Position[]> {
    const assets = await db.select().from(schema.assets).all();
    const positions: Position[] = [];

    for (const asset of assets) {
      const position = await this.getPositionForAsset(asset.id);
      if (position && position.quantity > 0) {
        positions.push(position);
      }
    }

    return positions;
  },

  // Get buy lots for an asset (for display)
  async getBuyLots(assetId: string): Promise<LotInfo[]> {
    const buyTransactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'buy')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate))
      .all();

    const realizedGainsData = await db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId))
      .all();

    // Calculate remaining quantity for each lot
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

  // Get total realized gains
  async getTotalRealizedGains(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(gain), 0)` })
      .from(schema.realizedGains)
      .all();
    return result[0]?.total ?? 0;
  },

  // Get realized gains by asset
  async getRealizedGainsByAsset(assetId: string): Promise<RealizedGain[]> {
    return db
      .select()
      .from(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId))
      .orderBy(desc(schema.realizedGains.realizedDate))
      .all();
  },

  async applySplit(assetId: string, ratio: number): Promise<{ adjustedCount: number }> {
    const allTx = await this.getByAssetId(assetId);
    if (allTx.length === 0) throw new Error('No transactions found for this asset');

    // Adjust all transaction quantities and prices
    for (const tx of allTx) {
      await db
        .update(schema.transactions)
        .set({
          quantity: tx.quantity * ratio,
          price: tx.price / ratio,
        })
        .where(eq(schema.transactions.id, tx.id));
    }

    // Adjust price history
    await db
      .update(schema.priceHistory)
      .set({ price: sql`price / ${ratio}` })
      .where(eq(schema.priceHistory.assetId, assetId));

    // Delete all realized gains for this asset — we'll regenerate them
    await db
      .delete(schema.realizedGains)
      .where(eq(schema.realizedGains.assetId, assetId));

    // Re-fetch adjusted sell transactions and reprocess FIFO
    const sellTx = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          eq(schema.transactions.type, 'sell')
        )
      )
      .orderBy(asc(schema.transactions.transactionDate))
      .all();

    for (const sell of sellTx) {
      await this.processFIFOSale(
        sell.id,
        assetId,
        sell.quantity,
        sell.price,
        sell.transactionDate
      );
    }

    return { adjustedCount: allTx.length };
  },

  /** Delete realized gain rows for an asset and re-run FIFO for all sells (oldest sell first). */
  async rebuildRealizedGainsForAsset(assetId: string): Promise<void> {
    await db.delete(schema.realizedGains).where(eq(schema.realizedGains.assetId, assetId));

    const sellTx = await db
      .select()
      .from(schema.transactions)
      .where(
        and(eq(schema.transactions.assetId, assetId), eq(schema.transactions.type, 'sell'))
      )
      .orderBy(asc(schema.transactions.transactionDate))
      .all();

    for (const sell of sellTx) {
      await this.processFIFOSale(
        sell.id,
        assetId,
        sell.quantity,
        sell.price,
        sell.transactionDate
      );
    }
  },
};
