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

export interface DimensionSlice {
  label: string;
  value: number;
  percentage: number;
  count: number;
}

export interface MultiDimensionalAllocation {
  byAssetClass: DimensionSlice[];
  byGeography: DimensionSlice[];
  byInstrumentType: DimensionSlice[];
  byRiskProfile: DimensionSlice[];
  byCurrency: DimensionSlice[];
  bySubCategory: DimensionSlice[];
}

const isIndianSymbol = (symbol: string) =>
  symbol.endsWith('.NS') || symbol.endsWith('.BO');

const GOV_SCHEME_CLASSES = new Set(['ppf', 'epf', 'nps']);
const METAL_CLASSES = new Set(['gold', 'silver', 'metals']);
const CASH_EQUIV_CLASSES = new Set(['cash', 'fixed_deposit', 'lended']);

const MF_CLASSES = new Set(['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt']);

function getGeography(assetClass: string, symbol: string): string {
  if (METAL_CLASSES.has(assetClass)) return 'Metals';
  if (CASH_EQUIV_CLASSES.has(assetClass)) return 'Cash & Equivalents';
  if (assetClass === 'crypto') return 'Crypto';
  if (GOV_SCHEME_CLASSES.has(assetClass)) return 'India';
  if (MF_CLASSES.has(assetClass)) return 'India';
  return isIndianSymbol(symbol) ? 'India' : 'International';
}

function getInstrumentType(assetClass: string): string {
  switch (assetClass) {
    case 'stocks': return 'Equities';
    case 'etf': return 'ETFs';
    case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Funds';
    case 'gold': case 'silver': case 'metals': return 'Commodities';
    case 'ppf': case 'epf': case 'nps': return 'Gov Schemes';
    case 'fixed_deposit': case 'bonds': return 'Fixed Income';
    case 'crypto': return 'Crypto';
    case 'lended': return 'Lended';
    case 'cash': return 'Cash';
    case 'real_estate': return 'Real Estate';
    default: return 'Other';
  }
}

function getRiskProfile(assetClass: string): string {
  switch (assetClass) {
    case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity': return 'Equity';
    case 'mutual_fund_debt': case 'bonds': case 'fixed_deposit': case 'ppf': case 'epf': return 'Debt';
    case 'gold': case 'silver': case 'metals': return 'Commodity';
    case 'crypto': case 'real_estate': case 'nps': return 'Alternative';
    case 'cash': case 'lended': return 'Cash';
    default: return 'Other';
  }
}

function getSubCategory(assetClass: string, symbol: string): string {
  const indian = isIndianSymbol(symbol);
  switch (assetClass) {
    case 'stocks': return indian ? 'Indian Stocks' : 'US Stocks';
    case 'etf': return indian ? 'Indian ETFs' : 'US ETFs';
    case 'mutual_fund': case 'mutual_fund_equity': return 'MF Equity';
    case 'mutual_fund_debt': return 'MF Debt';
    case 'gold': return 'Gold';
    case 'silver': return 'Silver';
    case 'metals': return 'Other Metals';
    case 'ppf': return 'PPF';
    case 'epf': return 'EPF';
    case 'nps': return 'NPS';
    case 'fixed_deposit': return 'Fixed Deposit';
    case 'lended': return 'Lended';
    case 'crypto': return 'Crypto';
    case 'cash': return 'Cash';
    case 'bonds': return 'Bonds';
    case 'real_estate': return 'Real Estate';
    default: return assetClass;
  }
}

function buildDimensionSlices(buckets: Map<string, { value: number; count: number }>, totalValue: number): DimensionSlice[] {
  const slices: DimensionSlice[] = [];
  for (const [label, data] of buckets) {
    slices.push({
      label,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      count: data.count,
    });
  }
  slices.sort((a, b) => b.value - a.value);
  return slices;
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

  async getMultiDimensionalAllocation(): Promise<MultiDimensionalAllocation> {
    const positions = await transactionService.getAllPositions();

    const byAssetClass = new Map<string, { value: number; count: number }>();
    const byGeography = new Map<string, { value: number; count: number }>();
    const byInstrumentType = new Map<string, { value: number; count: number }>();
    const byRiskProfile = new Map<string, { value: number; count: number }>();
    const byCurrency = new Map<string, { value: number; count: number }>();
    const bySubCategory = new Map<string, { value: number; count: number }>();

    let totalValue = 0;

    for (const p of positions) {
      totalValue += p.currentValue;
      const v = p.currentValue;

      const addTo = (map: Map<string, { value: number; count: number }>, key: string) => {
        const e = map.get(key) || { value: 0, count: 0 };
        e.value += v;
        e.count += 1;
        map.set(key, e);
      };

      addTo(byAssetClass, getSubCategory(p.assetClass, p.symbol));
      addTo(byGeography, getGeography(p.assetClass, p.symbol));
      addTo(byInstrumentType, getInstrumentType(p.assetClass));
      addTo(byRiskProfile, getRiskProfile(p.assetClass));
      addTo(byCurrency, p.currency || 'INR');
      addTo(bySubCategory, getSubCategory(p.assetClass, p.symbol));
    }

    return {
      byAssetClass: buildDimensionSlices(byAssetClass, totalValue),
      byGeography: buildDimensionSlices(byGeography, totalValue),
      byInstrumentType: buildDimensionSlices(byInstrumentType, totalValue),
      byRiskProfile: buildDimensionSlices(byRiskProfile, totalValue),
      byCurrency: buildDimensionSlices(byCurrency, totalValue),
      bySubCategory: buildDimensionSlices(bySubCategory, totalValue),
    };
  },
};
