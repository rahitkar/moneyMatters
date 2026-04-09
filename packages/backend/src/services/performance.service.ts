import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, client, schema } from '../db/index.js';
import { transactionService } from './transaction.service.js';
import { benchmarkService, type BenchmarkPerformance } from './benchmark.service.js';
import { exchangeRateProvider } from '../providers/exchange-rate.provider.js';
import type { TimeInterval, AssetClass, PortfolioSnapshot } from '../db/schema.js';
import { todayLocal, dateToLocal } from '../lib/date.js';

const PHYSICAL_METAL_CLASSES = new Set<string>(['gold_physical', 'silver_physical']);
const METAL_SELL_FACTOR = 0.95;

// Portfolio segments for filtered comparison
export interface SegmentFilter {
  assetClasses?: string[];
  currencyIs?: string;    // exact match
  currencyNot?: string;   // exclude match
}

export const PORTFOLIO_SEGMENTS: Record<string, { label: string; filters: SegmentFilter[] }> = {
  all:                  { label: 'Total Portfolio', filters: [] },
  indian_stocks:        { label: 'Indian Stocks', filters: [{ assetClasses: ['stocks'], currencyIs: 'INR' }] },
  international_stocks: { label: "Int'l Stocks", filters: [{ assetClasses: ['stocks'], currencyNot: 'INR' }] },
  equity_mf:            { label: 'Equity MF', filters: [{ assetClasses: ['mutual_fund_equity'] }] },
  debt_mf:              { label: 'Debt MF', filters: [{ assetClasses: ['mutual_fund_debt'] }] },
  indian_etf:           { label: 'Indian ETF', filters: [{ assetClasses: ['etf'], currencyIs: 'INR' }] },
  international_etf:    { label: "Int'l ETF", filters: [{ assetClasses: ['etf'], currencyNot: 'INR' }] },
  crypto:               { label: 'Crypto', filters: [{ assetClasses: ['crypto'] }] },
  gold:                 { label: 'Gold', filters: [{ assetClasses: ['gold', 'gold_physical'] }] },
  all_equity:           { label: 'All Equity', filters: [
    { assetClasses: ['stocks'] },
    { assetClasses: ['mutual_fund_equity'] },
    { assetClasses: ['etf'] },
  ]},
};

function toInr(value: number, currency: string, usdToInr: number | null): number {
  if (currency === 'INR') return value;
  if (currency === 'USD' && usdToInr) return value * usdToInr;
  return value;
}

export interface PerformanceMetrics {
  startValue: number;
  endValue: number;
  absoluteReturn: number;
  percentageReturn: number;
  annualizedReturn: number | null; // Only for periods > 1 year
  totalCost: number;
  realizedGains: number;
  unrealizedGains: number;
}

export interface PortfolioPerformance extends PerformanceMetrics {
  interval: TimeInterval;
  startDate: string;
  endDate: string;
  valueHistory: { date: string; value: number }[];
  navHistory: { date: string; nav: number }[];
  currentNAV: number;
  totalUnits: number;
}

export interface PerformanceComparison {
  portfolio: PortfolioPerformance;
  benchmarks: BenchmarkPerformance[];
}

export interface AssetClassPerformance {
  assetClass: AssetClass;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

export interface TagPerformance {
  tagId: string;
  tagName: string;
  tagColor: string;
  performance: PerformanceMetrics;
  holdings: number;
  currentValue: number;
}

// Calculate start date based on interval. For ALL/CUSTOM, returns null (caller resolves from data or explicit dates).
function getStartDate(interval: TimeInterval): Date | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  switch (interval) {
    case '1D':
      return new Date(now.setDate(now.getDate() - 1));
    case '5D':
      return new Date(now.setDate(now.getDate() - 5));
    case '1W':
      return new Date(now.setDate(now.getDate() - 7));
    case '1M':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3M':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6M':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1Y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case 'YTD':
      return new Date(now.getFullYear(), 0, 1);
    case 'ALL':
    case 'CUSTOM':
      return null;
    default:
      return new Date(now.setMonth(now.getMonth() - 1));
  }
}

async function getFirstTransactionDate(
  userId: string,
  allowedAssetIds?: Set<string>
): Promise<string | null> {
  if (!allowedAssetIds) {
    const row = await db
      .select({ minDate: sql<string>`MIN(${schema.transactions.transactionDate})` })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId))
      .then((r) => r[0]);
    return row?.minDate ?? null;
  }
  const rows = await db
    .select({ date: schema.transactions.transactionDate, assetId: schema.transactions.assetId })
    .from(schema.transactions)
    .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
    .where(eq(schema.assets.userId, userId))
    .orderBy(asc(schema.transactions.transactionDate));
  const first = rows.find((r) => allowedAssetIds.has(r.assetId));
  return first?.date ?? null;
}

// Calculate days between dates
function daysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate annualized return
function calculateAnnualizedReturn(
  percentageReturn: number,
  days: number
): number | null {
  if (days < 365) return null;
  const years = days / 365;
  return (Math.pow(1 + percentageReturn / 100, 1 / years) - 1) * 100;
}

function generateSampleDates(startStr: string, endStr: string, interval: TimeInterval): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);

  let stepDays: number;
  const skipWeekends = interval === '1D' || interval === '5D' || interval === '1W';
  switch (interval) {
    case '1D': case '5D': case '1W': case '1M': stepDays = 1; break;
    case '3M': stepDays = 3; break;
    case '6M': case '1Y': case 'YTD': stepDays = 7; break;
    case 'ALL': stepDays = 14; break;
    default: stepDays = 7;
  }

  const current = new Date(start);
  while (current <= end) {
    const day = current.getUTCDay();
    if (!skipWeekends || (day !== 0 && day !== 6)) {
      dates.push(dateToLocal(current));
    }
    current.setDate(current.getDate() + stepDays);
  }

  const endDateStr = dateToLocal(end);
  const endDay = end.getUTCDay();
  const endIsWeekend = skipWeekends && (endDay === 0 || endDay === 6);
  if (!endIsWeekend && (dates.length === 0 || dates[dates.length - 1] !== endDateStr)) {
    dates.push(endDateStr);
  }

  return dates;
}

function getPriceAtDate(timeline: { date: string; price: number }[], targetDate: string): number {
  let best = 0;
  for (const entry of timeline) {
    if (entry.date <= targetDate) {
      best = entry.price;
    } else {
      break;
    }
  }
  return best;
}

const BASE_NAV = 1000;

async function resolveSegmentAssetIds(
  userId: string,
  segments: string[]
): Promise<Set<string> | undefined> {
  if (segments.length === 0 || segments.includes('all')) return undefined;

  const allAssets = await db
    .select({
      id: schema.assets.id,
      assetClass: schema.assets.assetClass,
      currency: schema.assets.currency,
    })
    .from(schema.assets)
    .where(eq(schema.assets.userId, userId));
  const ids = new Set<string>();
  for (const seg of segments) {
    const def = PORTFOLIO_SEGMENTS[seg];
    if (!def || def.filters.length === 0) continue;
    for (const filter of def.filters) {
      for (const asset of allAssets) {
        if (filter.assetClasses && !filter.assetClasses.includes(asset.assetClass)) continue;
        if (filter.currencyIs && (asset.currency || 'INR') !== filter.currencyIs) continue;
        if (filter.currencyNot && (asset.currency || 'INR') === filter.currencyNot) continue;
        ids.add(asset.id);
      }
    }
  }
  return ids;
}

export type AllocDimension = 'bySubCategory' | 'byAssetClass' | 'byGeography' | 'byInstrumentType' | 'byRiskProfile' | 'byCurrency' | 'byLiquidity' | 'byOwnership';

const ALLOC_METAL = new Set(['gold', 'gold_physical', 'silver', 'silver_physical', 'metals']);
const ALLOC_CASH = new Set(['cash', 'fixed_deposit', 'lended', 'bonds']);
const ALLOC_GOV = new Set(['ppf', 'epf', 'nps']);
const ALLOC_MF = new Set(['mutual_fund', 'mutual_fund_equity', 'mutual_fund_debt']);
const isIndian = (s: string) => s.endsWith('.NS') || s.endsWith('.BO');

export function getDimensionLabel(dim: AllocDimension, assetClass: string, symbol: string, currency: string): string {
  const indian = isIndian(symbol);
  switch (dim) {
    case 'byAssetClass':
      switch (assetClass) {
        case 'stocks': return 'Stocks'; case 'etf': return 'ETF';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Fund';
        case 'gold': return 'Gold'; case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver'; case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'bySubCategory':
      switch (assetClass) {
        case 'stocks': return indian ? 'Indian Stocks' : 'US Stocks';
        case 'etf': return indian ? 'Indian ETFs' : 'US ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': return 'MF Equity';
        case 'mutual_fund_debt': return 'MF Debt';
        case 'gold': return 'Gold ETF'; case 'gold_physical': return 'Gold (Physical)';
        case 'silver': return 'Silver ETF'; case 'silver_physical': return 'Silver (Physical)';
        case 'metals': return 'Commodities';
        case 'ppf': return 'PPF'; case 'epf': return 'EPF'; case 'nps': return 'NPS';
        case 'fixed_deposit': return 'Fixed Deposit'; case 'lended': return 'Lended';
        case 'crypto': return 'Crypto'; case 'cash': return 'Cash'; case 'bonds': return 'Bonds';
        case 'real_estate': return 'Property'; case 'vehicle': return 'Vehicle';
        case 'external_portfolio': return 'External Portfolio';
        default: return assetClass;
      }
    case 'byGeography':
      if (ALLOC_METAL.has(assetClass)) return 'Metals';
      if (ALLOC_CASH.has(assetClass)) return 'Cash & Equivalents';
      if (assetClass === 'real_estate' || assetClass === 'vehicle') return 'Physical Assets';
      if (assetClass === 'crypto') return 'Crypto';
      if (assetClass === 'external_portfolio') return 'External';
      if (ALLOC_GOV.has(assetClass) || ALLOC_MF.has(assetClass)) return 'India';
      return indian ? 'India' : 'International';
    case 'byInstrumentType':
      switch (assetClass) {
        case 'stocks': return 'Equities'; case 'etf': return 'ETFs';
        case 'mutual_fund': case 'mutual_fund_equity': case 'mutual_fund_debt': return 'Mutual Funds';
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical': case 'metals': return 'Commodities';
        case 'ppf': case 'epf': case 'nps': return 'Gov Schemes';
        case 'fixed_deposit': case 'bonds': return 'Fixed Income';
        case 'crypto': return 'Crypto'; case 'lended': return 'Lended'; case 'cash': return 'Cash';
        case 'real_estate': case 'vehicle': return 'Physical Assets';
        case 'external_portfolio': return 'External Portfolio';
        default: return 'Other';
      }
    case 'byRiskProfile':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'gold': case 'gold_physical': case 'silver': case 'silver_physical':
        case 'metals': case 'crypto': case 'external_portfolio':
          return 'Growth Investment';
        case 'mutual_fund_debt': case 'bonds': case 'fixed_deposit': return 'Protective Investment';
        case 'lended': return 'Lended';
        case 'epf': case 'ppf': case 'nps': return 'Retirement';
        case 'real_estate': case 'vehicle': return 'Physical Asset';
        case 'cash': return 'Cash';
        default: return 'Other';
      }
    case 'byLiquidity':
      switch (assetClass) {
        case 'stocks': case 'etf': case 'mutual_fund': case 'mutual_fund_equity':
        case 'mutual_fund_debt': case 'crypto': case 'cash': case 'bonds':
        case 'fixed_deposit': case 'external_portfolio':
        case 'gold': case 'silver': case 'metals':
          return 'Liquid';
        case 'gold_physical': case 'silver_physical':
        case 'ppf': case 'epf': case 'nps':
        case 'lended': case 'real_estate': case 'vehicle':
          return 'Non-Liquid';
        default: return 'Other';
      }
    case 'byCurrency':
      return currency || 'INR';
    case 'byOwnership':
      return assetClass === 'external_portfolio' ? "Dad's Portfolio" : 'My Portfolio';
  }
}

export const performanceService = {
  async _loadPriceTimelines(userId: string, endDateStr: string, allowedAssetIds?: Set<string>, startDateStr?: string) {
    const txRows = await db
      .select({ tx: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(eq(schema.assets.userId, userId))
      .orderBy(asc(schema.transactions.transactionDate));
    let transactions = txRows.map((r) => r.tx);

    if (allowedAssetIds) {
      transactions = transactions.filter((tx) => allowedAssetIds.has(tx.assetId));
    }

    const assets = await db.select().from(schema.assets).where(eq(schema.assets.userId, userId));
    const currentPrices = new Map(assets.map((a) => [a.id, a.currentPrice ?? 0]));
    const currencyMap = new Map(assets.map((a) => [a.id, a.currency || 'INR']));
    const assetClassMap = new Map(assets.map((a) => [a.id, a.assetClass]));
    const symbolMap = new Map(assets.map((a) => [a.id, a.symbol]));

    const assetIdList = assets.map((a) => a.id);
    const priceHistoryRecords =
      assetIdList.length > 0
        ? await db
            .select({
              assetId: schema.priceHistory.assetId,
              recordedAt: schema.priceHistory.recordedAt,
              price: schema.priceHistory.price,
            })
            .from(schema.priceHistory)
            .where(
              startDateStr
                ? and(
                    inArray(schema.priceHistory.assetId, assetIdList),
                    gte(schema.priceHistory.recordedAt, new Date(startDateStr))
                  )
                : inArray(schema.priceHistory.assetId, assetIdList)
            )
            .orderBy(asc(schema.priceHistory.recordedAt))
        : [];

    const priceTimeline = new Map<string, { date: string; price: number }[]>();

    for (const tx of transactions) {
      if (!priceTimeline.has(tx.assetId)) priceTimeline.set(tx.assetId, []);
      priceTimeline.get(tx.assetId)!.push({ date: tx.transactionDate, price: tx.price });
    }

    for (const ph of priceHistoryRecords) {
      const dateStr = dateToLocal(new Date(ph.recordedAt.getTime()));
      if (!priceTimeline.has(ph.assetId)) priceTimeline.set(ph.assetId, []);
      priceTimeline.get(ph.assetId)!.push({ date: dateStr, price: ph.price });
    }

    const todayStr = todayLocal();
    const isLiveEnd = endDateStr >= todayStr;
    if (isLiveEnd) {
      for (const [assetId, price] of currentPrices) {
        if (price > 0) {
          if (!priceTimeline.has(assetId)) priceTimeline.set(assetId, []);
          priceTimeline.get(assetId)!.push({ date: endDateStr, price });
        }
      }
    }

    for (const [assetId, timeline] of priceTimeline) {
      const seen = new Map<string, number>();
      for (const entry of timeline) {
        seen.set(entry.date, entry.price);
      }
      priceTimeline.set(
        assetId,
        Array.from(seen, ([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date))
      );
    }

    return { transactions, priceTimeline, currentPrices, currencyMap, assetClassMap, symbolMap };
  },

  // Calculate portfolio value (in INR) from positions and price timelines at a given date
  _calcPortfolioValue(
    positions: Map<string, number>,
    priceTimeline: Map<string, { date: string; price: number }[]>,
    date: string,
    currencyMap: Map<string, string>,
    assetClassMap: Map<string, string>,
    usdToInr: number | null
  ): number {
    let total = 0;
    for (const [assetId, quantity] of positions) {
      if (quantity <= 0) continue;
      const price = getPriceAtDate(priceTimeline.get(assetId) ?? [], date);
      const cur = currencyMap.get(assetId) ?? 'INR';
      let value = toInr(quantity * price, cur, usdToInr);
      if (PHYSICAL_METAL_CLASSES.has(assetClassMap.get(assetId) ?? '')) {
        value *= METAL_SELL_FACTOR;
      }
      total += value;
    }
    return total;
  },

  _calcPortfolioValueByCategory(
    positions: Map<string, number>,
    priceTimeline: Map<string, { date: string; price: number }[]>,
    date: string,
    currencyMap: Map<string, string>,
    assetClassMap: Map<string, string>,
    symbolMap: Map<string, string>,
    usdToInr: number | null,
    dimension: AllocDimension
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [assetId, quantity] of positions) {
      if (quantity <= 0) continue;
      const price = getPriceAtDate(priceTimeline.get(assetId) ?? [], date);
      const cur = currencyMap.get(assetId) ?? 'INR';
      let value = toInr(quantity * price, cur, usdToInr);
      if (PHYSICAL_METAL_CLASSES.has(assetClassMap.get(assetId) ?? '')) {
        value *= METAL_SELL_FACTOR;
      }
      const label = getDimensionLabel(dimension, assetClassMap.get(assetId) ?? '', symbolMap.get(assetId) ?? '', cur);
      result[label] = (result[label] ?? 0) + value;
    }
    return result;
  },

  async buildValueHistoryByDimension(
    userId: string,
    interval: TimeInterval,
    dimension: AllocDimension
  ): Promise<{ series: { date: string; total: number; [key: string]: number | string }[] }> {
    const endDate = new Date();
    const endDateStr = dateToLocal(endDate);

    let startDate: Date | null = getStartDate(interval);
    if (!startDate) {
      const firstTxDate = await getFirstTransactionDate(userId);
      startDate = firstTxDate ? new Date(firstTxDate) : new Date();
    }
    const startDateStr = dateToLocal(startDate);

    const { transactions, priceTimeline, currencyMap, assetClassMap, symbolMap } =
      await this._loadPriceTimelines(userId, endDateStr, undefined, startDateStr);

    if (transactions.length === 0) return { series: [] };

    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    const firstTxDate = transactions[0].transactionDate;
    const includesInception = startDateStr <= firstTxDate;

    const positions = new Map<string, number>();
    let txIdx = 0;

    while (txIdx < transactions.length && transactions[txIdx].transactionDate < startDateStr) {
      const tx = transactions[txIdx];
      if (tx.type === 'buy') {
        positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) + tx.quantity);
      } else {
        positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) - tx.quantity);
      }
      txIdx++;
    }

    const effectiveStart = includesInception ? firstTxDate : startDateStr;
    const sampleDates = generateSampleDates(effectiveStart, endDateStr, interval);
    const series: { date: string; total: number; [key: string]: number | string }[] = [];

    for (const sampleDate of sampleDates) {
      while (txIdx < transactions.length && transactions[txIdx].transactionDate <= sampleDate) {
        const tx = transactions[txIdx];
        if (tx.type === 'buy') {
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) + tx.quantity);
        } else {
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) - tx.quantity);
        }
        txIdx++;
      }

      const byCategory = this._calcPortfolioValueByCategory(
        positions, priceTimeline, sampleDate,
        currencyMap, assetClassMap, symbolMap, usdToInr, dimension
      );

      let total = 0;
      for (const v of Object.values(byCategory)) total += v;
      if (total > 0) {
        series.push({ date: sampleDate, total, ...byCategory });
      }
    }

    return { series };
  },

  /**
   * Build both NAV and raw-value histories in a single pass.
   *
   * NAV curve (mutual-fund style): deposits/withdrawals create/remove units at
   * current NAV so the curve reflects pure investment performance.
   *
   * Value curve: absolute portfolio value including deposits — used by Dashboard.
   */
  async buildHistories(
    userId: string,
    startDateStr: string,
    endDateStr: string,
    interval: TimeInterval,
    allowedAssetIds?: Set<string>
  ): Promise<{
    navHistory: { date: string; nav: number }[];
    valueHistory: { date: string; value: number }[];
    units: number;
    currentNAV: number;
  }> {
    const { transactions, priceTimeline, currencyMap, assetClassMap } =
      await this._loadPriceTimelines(userId, endDateStr, allowedAssetIds, startDateStr);

    if (transactions.length === 0) {
      return { navHistory: [], valueHistory: [], units: 0, currentNAV: BASE_NAV };
    }

    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    const firstTxDate = transactions[0].transactionDate;
    const includesInception = startDateStr <= firstTxDate;

    // Phase 1: replay all transactions BEFORE the interval to build up
    // correct positions, units, and NAV state without recording history
    const positions = new Map<string, number>();
    let units = 0;
    let nav = BASE_NAV;
    let txIdx = 0;

    while (txIdx < transactions.length && transactions[txIdx].transactionDate < startDateStr) {
      const tx = transactions[txIdx];
      const preValue = this._calcPortfolioValue(
        positions, priceTimeline, tx.transactionDate,
        currencyMap, assetClassMap, usdToInr
      );
      if (units > 0 && preValue > 0) nav = preValue / units;

      const cur = currencyMap.get(tx.assetId) ?? 'INR';
      const txAmountInr = toInr(tx.quantity * tx.price, cur, usdToInr);
      if (tx.type === 'buy') {
        if (units === 0) nav = BASE_NAV;
        units += txAmountInr / nav;
        positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) + tx.quantity);
      } else {
        if (nav > 0) units = Math.max(0, units - txAmountInr / nav);
        positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) - tx.quantity);
      }
      txIdx++;
    }

    // Phase 2: generate sample dates and record history within the interval
    const effectiveStart = includesInception ? firstTxDate : startDateStr;
    const sampleDates = generateSampleDates(effectiveStart, endDateStr, interval);

    const navHistory: { date: string; nav: number }[] = [];
    const valueHistory: { date: string; value: number }[] = [];

    // For ALL interval, record inception at NAV=1000
    if (includesInception && sampleDates[0] === firstTxDate) {
      // Process transactions on the first tx date, then record inception
      while (txIdx < transactions.length && transactions[txIdx].transactionDate <= firstTxDate) {
        const tx = transactions[txIdx];
        const preValue = this._calcPortfolioValue(
          positions, priceTimeline, tx.transactionDate,
          currencyMap, assetClassMap, usdToInr
        );
        if (units > 0 && preValue > 0) nav = preValue / units;

        const cur = currencyMap.get(tx.assetId) ?? 'INR';
        const txAmountInr = toInr(tx.quantity * tx.price, cur, usdToInr);
        if (tx.type === 'buy') {
          if (units === 0) nav = BASE_NAV;
          units += txAmountInr / nav;
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) + tx.quantity);
        } else {
          if (nav > 0) units = Math.max(0, units - txAmountInr / nav);
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) - tx.quantity);
        }
        txIdx++;
      }
      const costValue = units * BASE_NAV;
      navHistory.push({ date: firstTxDate, nav: BASE_NAV });
      valueHistory.push({ date: firstTxDate, value: costValue });
    }

    for (const sampleDate of sampleDates) {
      // Skip inception date if already recorded
      if (navHistory.length > 0 && navHistory[0].date === sampleDate && sampleDate === firstTxDate) {
        continue;
      }

      while (txIdx < transactions.length && transactions[txIdx].transactionDate <= sampleDate) {
        const tx = transactions[txIdx];
        const preValue = this._calcPortfolioValue(
          positions, priceTimeline, tx.transactionDate,
          currencyMap, assetClassMap, usdToInr
        );
        if (units > 0 && preValue > 0) nav = preValue / units;

        const cur = currencyMap.get(tx.assetId) ?? 'INR';
        const txAmountInr = toInr(tx.quantity * tx.price, cur, usdToInr);
        if (tx.type === 'buy') {
          if (units === 0) nav = BASE_NAV;
          units += txAmountInr / nav;
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) + tx.quantity);
        } else {
          if (nav > 0) units = Math.max(0, units - txAmountInr / nav);
          positions.set(tx.assetId, (positions.get(tx.assetId) ?? 0) - tx.quantity);
        }
        txIdx++;
      }

      const portfolioValue = this._calcPortfolioValue(
        positions, priceTimeline, sampleDate,
        currencyMap, assetClassMap, usdToInr
      );
      if (units > 0 && portfolioValue > 0) {
        nav = portfolioValue / units;
      }

      if (units > 0) {
        navHistory.push({ date: sampleDate, nav });
      }
      if (portfolioValue > 0) {
        valueHistory.push({ date: sampleDate, value: portfolioValue });
      }
    }

    return { navHistory, valueHistory, units, currentNAV: nav };
  },

  // Get portfolio performance for a given interval
  async getPortfolioPerformance(
    userId: string,
    interval: TimeInterval,
    allowedAssetIds?: Set<string>,
    customStart?: string,
    customEnd?: string
  ): Promise<PortfolioPerformance> {
    const endDate = customEnd ? new Date(customEnd) : new Date();
    const endDateStr = dateToLocal(endDate);

    let startDate: Date | null = customStart ? new Date(customStart) : getStartDate(interval);
    if (!startDate) {
      const firstTxDate = await getFirstTransactionDate(userId, allowedAssetIds);
      startDate = firstTxDate ? new Date(firstTxDate) : new Date();
    }
    const startDateStr = dateToLocal(startDate);

    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    const todayStr = todayLocal();
    const isLive = endDateStr >= todayStr;

    let positions = await transactionService.getAllPositions(userId);
    if (allowedAssetIds) {
      positions = positions.filter((p) => allowedAssetIds.has(p.assetId));
    }
    let currentValue = 0;
    let currentCost = 0;
    let unrealizedGains = 0;
    for (const p of positions) {
      const cur = p.currency || 'INR';
      const metalAdj = PHYSICAL_METAL_CLASSES.has(p.assetClass) ? METAL_SELL_FACTOR : 1;
      currentValue += toInr(p.currentValue, cur, usdToInr) * metalAdj;
      currentCost += toInr(p.totalCost, cur, usdToInr);
      unrealizedGains += toInr(p.unrealizedGain, cur, usdToInr) * metalAdj;
    }
    const realizedGains = await transactionService.getTotalRealizedGains(userId);

    // Build both NAV and raw-value histories in a single pass
    const { navHistory, valueHistory, units: totalUnits, currentNAV } =
      await this.buildHistories(userId, startDateStr, endDateStr, interval, allowedAssetIds);

    let finalNAV = currentNAV;
    let finalValue = currentValue;

    if (isLive) {
      // Patch last points with live current values
      finalNAV = totalUnits > 0 ? currentValue / totalUnits : currentNAV;
      if (navHistory.length > 0 && navHistory[navHistory.length - 1].date === endDateStr) {
        navHistory[navHistory.length - 1].nav = finalNAV;
      } else if (totalUnits > 0) {
        navHistory.push({ date: endDateStr, nav: finalNAV });
      }
      if (valueHistory.length > 0 && valueHistory[valueHistory.length - 1].date === endDateStr) {
        valueHistory[valueHistory.length - 1].value = currentValue;
      } else {
        valueHistory.push({ date: endDateStr, value: currentValue });
      }
    } else {
      // Historical end date: derive values from the history
      finalNAV = navHistory.length > 0 ? navHistory[navHistory.length - 1].nav : BASE_NAV;
      finalValue = valueHistory.length > 0 ? valueHistory[valueHistory.length - 1].value : 0;
    }

    // NAV-based returns (pure investment performance)
    const startNAV = navHistory.length > 0 ? navHistory[0].nav : BASE_NAV;
    const endNAV = navHistory.length > 0 ? navHistory[navHistory.length - 1].nav : BASE_NAV;
    const navReturn = startNAV > 0 ? ((endNAV - startNAV) / startNAV) * 100 : 0;
    const days = daysBetween(startDate, endDate);

    const absoluteReturn = isLive
      ? unrealizedGains + realizedGains
      : finalValue - currentCost;

    return {
      interval,
      startDate: startDateStr,
      endDate: endDateStr,
      startValue: currentCost,
      endValue: finalValue,
      absoluteReturn,
      percentageReturn: navReturn,
      annualizedReturn: calculateAnnualizedReturn(navReturn, days),
      totalCost: currentCost,
      realizedGains,
      unrealizedGains: isLive ? unrealizedGains : finalValue - currentCost,
      valueHistory,
      navHistory,
      currentNAV: finalNAV,
      totalUnits,
    };
  },

  /**
   * Batch-fetch the latest price at or before `dateStr` for each assetId.
   * Returns Map<assetId, price>. One query instead of N.
   */
  async _batchPricesAtDate(assetIds: string[], dateStr: string): Promise<Map<string, number>> {
    if (assetIds.length === 0) return new Map();
    const cutoff = dateStr + 'T23:59:59Z';
    const rows = await client`
      SELECT DISTINCT ON (asset_id)
        asset_id, price
      FROM price_history
      WHERE asset_id IN ${client(assetIds)}
        AND recorded_at <= ${cutoff}::timestamptz
      ORDER BY asset_id, recorded_at DESC
    `;
    const result = new Map<string, number>();
    for (const row of rows) {
      result.set(row.asset_id, row.price);
    }
    return result;
  },

  /**
   * Batch-estimate values for multiple assets at a date.
   * Replaces per-asset estimateAssetValueAtDate calls.
   */
  async _batchEstimateAssetValues(
    assetIds: string[],
    dateStr: string
  ): Promise<Map<string, number>> {
    if (assetIds.length === 0) return new Map();

    const txs = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.assetId, assetIds),
          lte(schema.transactions.transactionDate, dateStr)
        )
      );

    const positionsByAsset = new Map<string, { quantity: number; cost: number }>();
    for (const tx of txs) {
      const cur = positionsByAsset.get(tx.assetId) || { quantity: 0, cost: 0 };
      if (tx.type === 'buy') {
        cur.quantity += tx.quantity;
        cur.cost += tx.quantity * tx.price;
      } else {
        cur.quantity -= tx.quantity;
        const avgCost = cur.quantity > 0 ? cur.cost / (cur.quantity + tx.quantity) : 0;
        cur.cost -= tx.quantity * avgCost;
      }
      positionsByAsset.set(tx.assetId, cur);
    }

    const heldAssetIds = [...positionsByAsset.entries()]
      .filter(([, p]) => p.quantity > 0)
      .map(([id]) => id);

    const priceMap = await this._batchPricesAtDate(heldAssetIds, dateStr);

    const result = new Map<string, number>();
    for (const [assetId, position] of positionsByAsset) {
      if (position.quantity <= 0) {
        result.set(assetId, 0);
        continue;
      }
      const price = priceMap.get(assetId);
      if (price != null) {
        result.set(assetId, position.quantity * price);
      } else {
        const avgCost = position.quantity > 0 ? position.cost / position.quantity : 0;
        result.set(assetId, position.quantity * avgCost);
      }
    }
    return result;
  },

  async estimatePortfolioValueAtDate(userId: string, dateStr: string): Promise<number> {
    const txRows = await db
      .select({ tx: schema.transactions })
      .from(schema.transactions)
      .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
      .where(
        and(eq(schema.assets.userId, userId), lte(schema.transactions.transactionDate, dateStr))
      )
      .orderBy(asc(schema.transactions.transactionDate));
    const transactions = txRows.map((r) => r.tx);

    const positions = new Map<string, { quantity: number; cost: number }>();
    for (const tx of transactions) {
      const current = positions.get(tx.assetId) || { quantity: 0, cost: 0 };
      if (tx.type === 'buy') {
        current.quantity += tx.quantity;
        current.cost += tx.quantity * tx.price;
      } else {
        current.quantity -= tx.quantity;
        const avgCost = current.quantity > 0 ? current.cost / (current.quantity + tx.quantity) : 0;
        current.cost -= tx.quantity * avgCost;
      }
      positions.set(tx.assetId, current);
    }

    const heldAssetIds = [...positions.entries()]
      .filter(([, p]) => p.quantity > 0)
      .map(([id]) => id);

    const priceMap = await this._batchPricesAtDate(heldAssetIds, dateStr);

    let totalValue = 0;
    for (const [assetId, position] of positions) {
      if (position.quantity <= 0) continue;
      const price = priceMap.get(assetId) || 0;
      totalValue += position.quantity * price;
    }

    if (totalValue === 0) {
      for (const [, position] of positions) {
        if (position.quantity > 0) {
          totalValue += position.cost;
        }
      }
    }

    return totalValue;
  },

  // Compare portfolio performance with benchmarks
  async compareWithBenchmarks(
    userId: string,
    interval: TimeInterval,
    benchmarkSymbols: string[],
    segments?: string[],
    customStart?: string,
    customEnd?: string
  ): Promise<PerformanceComparison> {
    const allowedAssetIds = segments ? await resolveSegmentAssetIds(userId, segments) : undefined;
    const portfolio = await this.getPortfolioPerformance(
      userId,
      interval,
      allowedAssetIds,
      customStart,
      customEnd
    );
    const benchmarks = await benchmarkService.getMultiplePerformance(
      benchmarkSymbols,
      interval,
      portfolio.startDate,
      interval === 'CUSTOM' ? portfolio.endDate : undefined
    );

    return { portfolio, benchmarks };
  },

  // Get performance by asset class
  async getPerformanceByAssetClass(
    userId: string,
    interval: TimeInterval
  ): Promise<AssetClassPerformance[]> {
    const positions = await transactionService.getAllPositions(userId);
    let startDate = getStartDate(interval);
    if (!startDate) {
      const firstTxDate = await getFirstTransactionDate(userId);
      startDate = firstTxDate ? new Date(firstTxDate) : new Date();
    }
    const startDateStr = dateToLocal(startDate);

    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    const byClass = new Map<
      AssetClass,
      { positions: typeof positions; currentValue: number; totalCost: number }
    >();

    for (const position of positions) {
      const assetClass = position.assetClass as AssetClass;
      const cur = position.currency || 'INR';
      const metalAdj = PHYSICAL_METAL_CLASSES.has(position.assetClass) ? METAL_SELL_FACTOR : 1;
      const existing = byClass.get(assetClass) || {
        positions: [],
        currentValue: 0,
        totalCost: 0,
      };
      existing.positions.push(position);
      existing.currentValue += toInr(position.currentValue, cur, usdToInr) * metalAdj;
      existing.totalCost += toInr(position.totalCost, cur, usdToInr);
      byClass.set(assetClass, existing);
    }

    const allAssetIds = positions.map((p) => p.assetId);
    const historicalValues = await this._batchEstimateAssetValues(allAssetIds, startDateStr);

    const results: AssetClassPerformance[] = [];

    for (const [assetClass, data] of byClass) {
      let startValue = 0;
      for (const position of data.positions) {
        const cur = position.currency || 'INR';
        const metalAdj = PHYSICAL_METAL_CLASSES.has(position.assetClass) ? METAL_SELL_FACTOR : 1;
        const historicalValue = historicalValues.get(position.assetId) ?? 0;
        startValue += toInr(historicalValue, cur, usdToInr) * metalAdj;
      }

      const endValue = data.currentValue;
      const absoluteReturn = endValue - startValue;
      const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;
      const days = daysBetween(startDate, new Date());

      let realizedGains = 0;
      let unrealizedGains = 0;
      for (const position of data.positions) {
        const cur = position.currency || 'INR';
        const metalAdj = PHYSICAL_METAL_CLASSES.has(position.assetClass) ? METAL_SELL_FACTOR : 1;
        realizedGains += toInr(position.realizedGain, cur, usdToInr);
        unrealizedGains += toInr(position.unrealizedGain, cur, usdToInr) * metalAdj;
      }

      results.push({
        assetClass,
        performance: {
          startValue,
          endValue,
          absoluteReturn,
          percentageReturn,
          annualizedReturn: calculateAnnualizedReturn(percentageReturn, days),
          totalCost: data.totalCost,
          realizedGains,
          unrealizedGains,
        },
        holdings: data.positions.length,
        currentValue: data.currentValue,
      });
    }

    return results.sort((a, b) => b.currentValue - a.currentValue);
  },

  // Estimate single asset value at a date
  async estimateAssetValueAtDate(userId: string, assetId: string, dateStr: string): Promise<number> {
    const assetOk = await db
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(and(eq(schema.assets.id, assetId), eq(schema.assets.userId, userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!assetOk) return 0;

    const transactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.assetId, assetId),
          lte(schema.transactions.transactionDate, dateStr)
        )
      );
    let quantity = 0;
    for (const tx of transactions) {
      if (tx.type === 'buy') {
        quantity += tx.quantity;
      } else {
        quantity -= tx.quantity;
      }
    }

    if (quantity <= 0) return 0;

    const priceRecord = await db
      .select()
      .from(schema.priceHistory)
      .where(
        and(
          eq(schema.priceHistory.assetId, assetId),
          lte(schema.priceHistory.recordedAt, new Date(dateStr + 'T23:59:59Z'))
        )
      )
      .orderBy(desc(schema.priceHistory.recordedAt))
      .limit(1)
      .then((r) => r[0]);

    if (priceRecord) {
      return quantity * priceRecord.price;
    }

    // No price history before this date — fall back to average cost from transactions
    let totalCost = 0;
    let totalQty = 0;
    for (const tx of transactions) {
      if (tx.type === 'buy') {
        totalCost += tx.quantity * tx.price;
        totalQty += tx.quantity;
      }
    }
    return totalQty > 0 ? quantity * (totalCost / totalQty) : 0;
  },

  // Get performance by tag
  async getPerformanceByTag(
    userId: string,
    tagId: string,
    interval: TimeInterval
  ): Promise<TagPerformance | null> {
    const tag = await db
      .select()
      .from(schema.tags)
      .where(and(eq(schema.tags.id, tagId), eq(schema.tags.userId, userId)))
      .limit(1)
      .then((r) => r[0]);

    if (!tag) return null;

    // Get assets with this tag
    const taggedAssets = await db
      .select({ assetId: schema.assetTags.assetId })
      .from(schema.assetTags)
      .where(eq(schema.assetTags.tagId, tagId));
    const assetIds = new Set(taggedAssets.map((t) => t.assetId));
    if (assetIds.size === 0) {
      return {
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
        performance: {
          startValue: 0,
          endValue: 0,
          absoluteReturn: 0,
          percentageReturn: 0,
          annualizedReturn: null,
          totalCost: 0,
          realizedGains: 0,
          unrealizedGains: 0,
        },
        holdings: 0,
        currentValue: 0,
      };
    }

    const allPositions = await transactionService.getAllPositions(userId);
    const positions = allPositions.filter((p) => assetIds.has(p.assetId));

    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    let startDate = getStartDate(interval);
    if (!startDate) {
      const firstTxDate = await getFirstTransactionDate(userId);
      startDate = firstTxDate ? new Date(firstTxDate) : new Date();
    }
    const startDateStr = dateToLocal(startDate);

    const tagAssetIds = positions.map((p) => p.assetId);
    const historicalValues = await this._batchEstimateAssetValues(tagAssetIds, startDateStr);

    let startValue = 0;
    let endValue = 0;
    let totalCost = 0;
    let realizedGains = 0;
    let unrealizedGains = 0;

    for (const position of positions) {
      const cur = position.currency || 'INR';
      const metalAdj = PHYSICAL_METAL_CLASSES.has(position.assetClass) ? METAL_SELL_FACTOR : 1;
      const histValue = historicalValues.get(position.assetId) ?? 0;
      startValue += toInr(histValue, cur, usdToInr) * metalAdj;
      endValue += toInr(position.currentValue, cur, usdToInr) * metalAdj;
      totalCost += toInr(position.totalCost, cur, usdToInr);
      realizedGains += toInr(position.realizedGain, cur, usdToInr);
      unrealizedGains += toInr(position.unrealizedGain, cur, usdToInr) * metalAdj;
    }

    const absoluteReturn = endValue - startValue;
    const percentageReturn = startValue > 0 ? (absoluteReturn / startValue) * 100 : 0;
    const days = daysBetween(startDate, new Date());

    return {
      tagId: tag.id,
      tagName: tag.name,
      tagColor: tag.color,
      performance: {
        startValue,
        endValue,
        absoluteReturn,
        percentageReturn,
        annualizedReturn: calculateAnnualizedReturn(percentageReturn, days),
        totalCost,
        realizedGains,
        unrealizedGains,
      },
      holdings: positions.length,
      currentValue: endValue,
    };
  },

  // Take a daily snapshot of portfolio value (all values in INR)
  async takeSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
    const today = todayLocal();
    const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
    const usdToInr = rateResult?.rate ?? null;

    const positions = await transactionService.getAllPositions(userId);
    let totalValue = 0;
    let totalCost = 0;
    const allocationByClass: Record<string, number> = {};
    for (const p of positions) {
      const cur = p.currency || 'INR';
      const metalAdj = PHYSICAL_METAL_CLASSES.has(p.assetClass) ? METAL_SELL_FACTOR : 1;
      const val = toInr(p.currentValue, cur, usdToInr) * metalAdj;
      totalValue += val;
      totalCost += toInr(p.totalCost, cur, usdToInr);
      allocationByClass[p.assetClass] = (allocationByClass[p.assetClass] || 0) + val;
    }
    const realizedGains = await transactionService.getTotalRealizedGains(userId);

    const existing = await db
      .select()
      .from(schema.portfolioSnapshots)
      .where(
        and(
          eq(schema.portfolioSnapshots.snapshotDate, today),
          eq(schema.portfolioSnapshots.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.portfolioSnapshots)
        .set({
          totalValue,
          totalCost,
          realizedGains,
          allocationBreakdown: JSON.stringify(allocationByClass),
        })
        .where(eq(schema.portfolioSnapshots.id, existing[0].id));

      return { ...existing[0], totalValue, totalCost };
    }

    const snapshot = {
      id: nanoid(),
      userId,
      snapshotDate: today,
      totalValue,
      totalCost,
      realizedGains,
      allocationBreakdown: JSON.stringify(allocationByClass),
      createdAt: new Date(),
    };

    await db.insert(schema.portfolioSnapshots).values(snapshot);
    return snapshot as PortfolioSnapshot;
  },

  // Get all snapshots for charting
  async getSnapshots(userId: string, interval: TimeInterval): Promise<PortfolioSnapshot[]> {
    let startDate = getStartDate(interval);
    if (!startDate) {
      const firstTxDate = await getFirstTransactionDate(userId);
      startDate = firstTxDate ? new Date(firstTxDate) : new Date();
    }
    const startDateStr = dateToLocal(startDate);

    return db
      .select()
      .from(schema.portfolioSnapshots)
      .where(
        and(
          eq(schema.portfolioSnapshots.userId, userId),
          gte(schema.portfolioSnapshots.snapshotDate, startDateStr)
        )
      )
      .orderBy(asc(schema.portfolioSnapshots.snapshotDate));
  },
};
