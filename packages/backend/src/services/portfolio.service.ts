import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { holdingService } from './holding.service.js';
import { transactionService } from './transaction.service.js';
import type { AssetClass } from '../db/schema.js';

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  currency: string;
  assetCount: number;
  holdingCount: number;
}

export interface AssetAllocation {
  assetClass: AssetClass;
  value: number;
  percentage: number;
  count: number;
}

export interface HoldingWithValue {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  purchasePrice: number;
  currentPrice: number | null;
  currentValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  currency: string;
}

export const portfolioService = {
  async getSummary(): Promise<PortfolioSummary> {
    // Try transaction-based positions first
    const positions = await transactionService.getAllPositions();
    
    if (positions.length > 0) {
      // Use transaction-based data
      let totalValue = 0;
      let totalCost = 0;
      const assetIds = new Set<string>();

      for (const position of positions) {
        totalValue += position.currentValue;
        totalCost += position.totalCost;
        assetIds.add(position.assetId);
      }

      const totalGain = totalValue - totalCost;
      const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

      return {
        totalValue,
        totalCost,
        totalGain,
        totalGainPercent,
        currency: 'INR', // Indian stocks
        assetCount: assetIds.size,
        holdingCount: positions.length,
      };
    }

    // Fallback to legacy holdings
    const holdingsWithAssets = await holdingService.getAllWithAssets();

    let totalValue = 0;
    let totalCost = 0;
    const assetIds = new Set<string>();

    for (const { holding, asset } of holdingsWithAssets) {
      const currentPrice = asset.currentPrice ?? holding.purchasePrice;
      const value = holding.quantity * currentPrice;
      const cost = holding.quantity * holding.purchasePrice;

      totalValue += value;
      totalCost += cost;
      assetIds.add(asset.id);
    }

    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      currency: 'USD',
      assetCount: assetIds.size,
      holdingCount: holdingsWithAssets.length,
    };
  },

  async getAllocation(): Promise<AssetAllocation[]> {
    // Try transaction-based positions first
    const positions = await transactionService.getAllPositions();
    
    if (positions.length > 0) {
      const byClass = new Map<AssetClass, { value: number; count: number }>();
      let totalValue = 0;

      for (const position of positions) {
        totalValue += position.currentValue;
        const assetClass = position.assetClass as AssetClass;
        const existing = byClass.get(assetClass) || { value: 0, count: 0 };
        existing.value += position.currentValue;
        existing.count += 1;
        byClass.set(assetClass, existing);
      }

      const allocations: AssetAllocation[] = [];
      for (const [assetClass, data] of byClass) {
        allocations.push({
          assetClass,
          value: data.value,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
          count: data.count,
        });
      }

      allocations.sort((a, b) => b.value - a.value);
      return allocations;
    }

    // Fallback to legacy holdings
    const holdingsWithAssets = await holdingService.getAllWithAssets();

    const byClass = new Map<AssetClass, { value: number; count: number }>();

    let totalValue = 0;

    for (const { holding, asset } of holdingsWithAssets) {
      const currentPrice = asset.currentPrice ?? holding.purchasePrice;
      const value = holding.quantity * currentPrice;
      totalValue += value;

      const existing = byClass.get(asset.assetClass) || { value: 0, count: 0 };
      existing.value += value;
      existing.count += 1;
      byClass.set(asset.assetClass, existing);
    }

    const allocations: AssetAllocation[] = [];
    for (const [assetClass, data] of byClass) {
      allocations.push({
        assetClass,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        count: data.count,
      });
    }

    // Sort by value descending
    allocations.sort((a, b) => b.value - a.value);

    return allocations;
  },

  async getHoldingsWithValues(): Promise<HoldingWithValue[]> {
    // Try transaction-based positions first
    const positions = await transactionService.getAllPositions();
    
    if (positions.length > 0) {
      return positions.map((position) => ({
        id: position.assetId, // Use assetId as id
        assetId: position.assetId,
        symbol: position.symbol,
        name: position.name,
        assetClass: position.assetClass as AssetClass,
        quantity: position.quantity,
        purchasePrice: position.averageCost,
        currentPrice: position.currentPrice,
        currentValue: position.currentValue,
        costBasis: position.totalCost,
        gain: position.unrealizedGain,
        gainPercent: position.unrealizedGainPercent,
        currency: 'INR',
      }));
    }

    // Fallback to legacy holdings
    const holdingsWithAssets = await holdingService.getAllWithAssets();

    return holdingsWithAssets.map(({ holding, asset }) => {
      const currentPrice = asset.currentPrice ?? holding.purchasePrice;
      const currentValue = holding.quantity * currentPrice;
      const costBasis = holding.quantity * holding.purchasePrice;
      const gain = currentValue - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

      return {
        id: holding.id,
        assetId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.assetClass,
        quantity: holding.quantity,
        purchasePrice: holding.purchasePrice,
        currentPrice,
        currentValue,
        costBasis,
        gain,
        gainPercent,
        currency: asset.currency || 'USD',
      };
    });
  },

  async getHoldingsByTag(tagId: string): Promise<HoldingWithValue[]> {
    // Get assets with this tag
    const assetTagResults = await db
      .select({ assetId: schema.assetTags.assetId })
      .from(schema.assetTags)
      .where(eq(schema.assetTags.tagId, tagId));

    const taggedAssetIds = new Set(assetTagResults.map((r) => r.assetId));

    const allHoldings = await this.getHoldingsWithValues();
    return allHoldings.filter((h) => taggedAssetIds.has(h.assetId));
  },

  async getHoldingsByAssetClass(assetClass: AssetClass): Promise<HoldingWithValue[]> {
    const allHoldings = await this.getHoldingsWithValues();
    return allHoldings.filter((h) => h.assetClass === assetClass);
  },

  async getTopPerformers(limit = 5): Promise<HoldingWithValue[]> {
    const holdings = await this.getHoldingsWithValues();
    return holdings
      .filter((h) => h.costBasis > 0)
      .sort((a, b) => b.gainPercent - a.gainPercent)
      .slice(0, limit);
  },

  async getWorstPerformers(limit = 5): Promise<HoldingWithValue[]> {
    const holdings = await this.getHoldingsWithValues();
    return holdings
      .filter((h) => h.costBasis > 0)
      .sort((a, b) => a.gainPercent - b.gainPercent)
      .slice(0, limit);
  },
};
