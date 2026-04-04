import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { yahooFinanceProvider } from '../providers/yahoo-finance.provider.js';
import { coingeckoProvider } from '../providers/coingecko.provider.js';
import { metalsProvider } from '../providers/metals.provider.js';
import { exchangeRateProvider } from '../providers/exchange-rate.provider.js';
import { indiaMfNavProvider } from '../providers/india-mf-nav.provider.js';
import { assetService } from './asset.service.js';
import { db, schema } from '../db/index.js';
import type { AssetClass, Provider } from '../db/schema.js';

const MANUAL_MF_CLASSES: AssetClass[] = [
  'mutual_fund',
  'mutual_fund_equity',
  'mutual_fund_debt',
];

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change?: number;
  changePercent?: number;
  provider: Provider;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  assetClass: AssetClass;
  provider: Provider;
}

// Determine the right provider based on asset class
function getProviderForAssetClass(assetClass: AssetClass): Provider {
  switch (assetClass) {
    case 'crypto':
      return 'coingecko';
    case 'gold':
    case 'gold_physical':
    case 'silver':
    case 'silver_physical':
    case 'metals':
      return 'metals_api';
    case 'ppf':
    case 'epf':
    case 'nps':
    case 'fixed_deposit':
    case 'bonds':
    case 'real_estate':
    case 'vehicle':
    case 'lended':
    case 'cash':
    case 'external_portfolio':
      return 'manual';
    default:
      return 'yahoo_finance';
  }
}

// Determine asset class from search result
function inferAssetClass(type: string, symbol: string): AssetClass {
  const upperType = type.toUpperCase();
  const upperSymbol = symbol.toUpperCase();

  if (upperType === 'CRYPTOCURRENCY' || upperType === 'CRYPTO') return 'crypto';
  if (upperType === 'ETF') return 'etf';
  if (upperType === 'MUTUALFUND' || upperType === 'MUTUAL_FUND') return 'mutual_fund_equity';
  if (metalsProvider.isMetalSymbol(upperSymbol)) {
    const metalKey = upperSymbol === 'GOLD' || upperSymbol === 'XAU' ? 'gold'
      : upperSymbol === 'SILVER' || upperSymbol === 'XAG' ? 'silver'
      : 'metals';
    return metalKey;
  }

  return 'stocks';
}

export const marketDataService = {
  async getQuote(symbol: string, assetClass?: AssetClass): Promise<MarketQuote | null> {
    // Check if it's a metal
    if (metalsProvider.isMetalSymbol(symbol)) {
      const quote = await metalsProvider.getQuote(symbol);
      if (quote) {
        return {
          symbol: quote.symbol,
          name: quote.name,
          price: quote.price,
          currency: quote.currency,
          provider: 'metals_api',
        };
      }
    }

    // Check if it might be crypto
    if (assetClass === 'crypto' || coingeckoProvider.getIdFromSymbol(symbol)) {
      const quote = await coingeckoProvider.getQuoteBySymbol(symbol);
      if (quote) {
        return {
          symbol: quote.symbol,
          name: quote.name,
          price: quote.price,
          currency: quote.currency,
          change: quote.change24h,
          changePercent: quote.changePercent24h,
          provider: 'coingecko',
        };
      }
    }

    // Default to Yahoo Finance for stocks/ETFs/mutual funds
    const quote = await yahooFinanceProvider.getQuote(symbol);
    if (quote) {
      return {
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        currency: quote.currency,
        change: quote.change,
        changePercent: quote.changePercent,
        provider: 'yahoo_finance',
      };
    }

    return null;
  },

  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Search Yahoo Finance (stocks, ETFs, mutual funds)
    const yahooResults = await yahooFinanceProvider.search(query);
    for (const result of yahooResults) {
      const assetClass = inferAssetClass(result.type, result.symbol);
      results.push({
        symbol: result.symbol,
        name: result.name,
        type: result.type,
        assetClass,
        provider: 'yahoo_finance',
      });
    }

    // Search CoinGecko (crypto)
    const cryptoResults = await coingeckoProvider.search(query);
    for (const result of cryptoResults) {
      results.push({
        symbol: result.symbol,
        name: result.name,
        type: 'CRYPTOCURRENCY',
        assetClass: 'crypto',
        provider: 'coingecko',
      });
    }

    // Check for metals
    const upperQuery = query.toUpperCase();
    if (metalsProvider.isMetalSymbol(upperQuery) || 
        ['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM'].some(m => m.includes(upperQuery))) {
      const metalSymbols = metalsProvider.getSupportedSymbols();
      for (const symbol of metalSymbols) {
        if (symbol.includes(upperQuery) || upperQuery.includes(symbol.substring(0, 3))) {
          const quote = await metalsProvider.getQuote(symbol);
          if (quote) {
            const metalClass = (symbol === 'GOLD' || symbol === 'XAU') ? 'gold'
              : (symbol === 'SILVER' || symbol === 'XAG') ? 'silver'
              : 'metals';
            results.push({
              symbol: quote.symbol,
              name: quote.name,
              type: 'COMMODITY',
              assetClass: metalClass,
              provider: 'metals_api',
            });
          }
        }
      }
    }

    return results;
  },

  async updateAllPrices(): Promise<{ updated: number; failed: number }> {
    const assets = await assetService.getAll();
    let updated = 0;
    let failed = 0;

    // Group assets by provider for efficient batch fetching
    const byProvider = new Map<Provider, typeof assets>();
    for (const asset of assets) {
      const list = byProvider.get(asset.provider) || [];
      list.push(asset);
      byProvider.set(asset.provider, list);
    }

    // Update Yahoo Finance assets
    const yahooAssets = byProvider.get('yahoo_finance') || [];
    if (yahooAssets.length > 0) {
      const symbols = [...new Set(yahooAssets.map((a) => a.symbol))];
      const quotes = await yahooFinanceProvider.getQuotes(symbols);
      for (const asset of yahooAssets) {
        const quote = quotes.get(asset.symbol);
        if (quote) {
          await assetService.updatePrice(asset.id, quote.price);
          updated++;
        } else {
          failed++;
        }
      }
    }

    // Update CoinGecko assets
    const cryptoAssets = byProvider.get('coingecko') || [];
    if (cryptoAssets.length > 0) {
      const coinIds = cryptoAssets
        .map((a) => coingeckoProvider.getIdFromSymbol(a.symbol))
        .filter((id): id is string => !!id);
      
      if (coinIds.length > 0) {
        const quotes = await coingeckoProvider.getQuotes(coinIds);
        for (const asset of cryptoAssets) {
          const coinId = coingeckoProvider.getIdFromSymbol(asset.symbol);
          if (coinId) {
            const quote = quotes.get(coinId);
            if (quote) {
              await assetService.updatePrice(asset.id, quote.price);
              updated++;
            } else {
              failed++;
            }
          }
        }
      }
    }

    // Update metals
    const metalAssets = byProvider.get('metals_api') || [];
    if (metalAssets.length > 0) {
      const metalPrices = await metalsProvider.getSpotPrices();

      // Physical metals stored in INR need USD→INR + oz→gram + India import premium.
      // Source is COMEX futures via Yahoo Finance. Each metal has a different effective
      // India premium because of varying futures-vs-spot spreads and local premiums.
      // Calibrated against Indian retail rates (April 2026):
      //   Gold:   $4,703 GC=F → ₹15,132/g (target ~₹15,093)  factor 1.08
      //   Silver: $73.17 SI=F → ₹250/g    (target ~₹250)      factor 1.147
      const TROY_OZ_TO_GRAMS = 31.1035;
      const INDIA_FACTORS: Record<string, number> = {
        GOLD: 1.08,
        SILVER: 1.147,
      };
      const DEFAULT_INDIA_FACTOR = 1.08;

      let usdToInr: number | null = null;
      const needsInr = metalAssets.some((a) => a.currency === 'INR');
      if (needsInr) {
        const rateResult = await exchangeRateProvider.getRate('USD', 'INR');
        usdToInr = rateResult?.rate ?? null;
      }

      for (const asset of metalAssets) {
        const symbolKey = asset.symbol.split('-')[0];
        const quote = metalPrices.get(asset.symbol) ?? metalPrices.get(symbolKey);
        if (quote) {
          let price = quote.price;
          if (asset.currency === 'INR' && usdToInr) {
            const factor = INDIA_FACTORS[symbolKey] ?? DEFAULT_INDIA_FACTOR;
            price = (price / TROY_OZ_TO_GRAMS) * usdToInr * factor;
          }
          await assetService.updatePrice(asset.id, price);
          updated++;
        } else {
          failed++;
        }
      }
    }

    // Indian mutual funds (Zerodha imports): provider is manual — fetch NAV from mfapi.in
    const mfManual = assets.filter(
      (a) =>
        a.provider === 'manual' &&
        MANUAL_MF_CLASSES.includes(a.assetClass as AssetClass)
    );
    for (const asset of mfManual) {
      try {
        const nav = await indiaMfNavProvider.fetchLatestNav({
          isin: asset.isin ?? null,
          name: asset.name,
          symbol: asset.symbol,
        });
        if (nav !== null) {
          await assetService.updatePrice(asset.id, nav);
          updated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  },

  async convertCurrency(
    amount: number,
    from: string,
    to: string
  ): Promise<number | null> {
    return exchangeRateProvider.convertAmount(amount, from, to);
  },

  async getExchangeRate(from: string, to: string) {
    return exchangeRateProvider.getRate(from, to);
  },

  async backfillHistoricalPrices(): Promise<{ updated: number; skipped: number; failed: number }> {
    const assets = await assetService.getAll();
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const firstTxDates = await db
      .select({
        assetId: schema.transactions.assetId,
        minDate: sql<string>`MIN(${schema.transactions.transactionDate})`,
      })
      .from(schema.transactions)
      .groupBy(schema.transactions.assetId)
      .all();
    const firstDateMap = new Map(firstTxDates.map((r) => [r.assetId, r.minDate]));

    const existingCounts = await db
      .select({
        assetId: schema.priceHistory.assetId,
        cnt: sql<number>`COUNT(*)`,
      })
      .from(schema.priceHistory)
      .groupBy(schema.priceHistory.assetId)
      .all();
    const countMap = new Map(existingCounts.map((r) => [r.assetId, r.cnt]));

    const today = new Date();

    for (const asset of assets) {
      const firstDate = firstDateMap.get(asset.id);
      if (!firstDate) { skipped++; continue; }

      const existingCount = countMap.get(asset.id) ?? 0;
      const daysSinceFirst = Math.ceil(
        (today.getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      // Skip if we already have at least 60% of expected trading days covered
      if (existingCount > 30 && existingCount > daysSinceFirst * 0.4) {
        skipped++;
        continue;
      }

      // Use the asset's actual stored provider, not derived from assetClass
      const provider = asset.provider as string;
      const startDate = new Date(firstDate);

      try {
        let prices: { date: Date; price: number }[] = [];

        if (provider === 'yahoo_finance') {
          const raw = await yahooFinanceProvider.getHistoricalPrices(asset.symbol, startDate, today);
          prices = raw.map((r) => ({ date: r.date, price: r.close }));
        } else if (provider === 'coingecko') {
          const coinId = coingeckoProvider.getIdFromSymbol(asset.symbol);
          if (coinId) {
            const days = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            prices = await coingeckoProvider.getHistoricalPrices(coinId, days, 'usd');
          }
        } else {
          // manual / metals_api — no historical API available
          skipped++;
          continue;
        }

        if (prices.length === 0) { failed++; continue; }

        // Batch-load existing dates for this asset
        const existingDates = new Set(
          (await db
            .select({ d: sql<string>`date(${schema.priceHistory.recordedAt} / 1000, 'unixepoch')` })
            .from(schema.priceHistory)
            .where(eq(schema.priceHistory.assetId, asset.id))
            .all()
          ).map((r) => r.d)
        );

        // Deduplicate within the batch (CoinGecko can return multiple points per day)
        const seenDates = new Set<string>();
        const rows = prices
          .filter((p) => {
            const dateStr = p.date.toISOString().split('T')[0];
            if (p.price <= 0 || existingDates.has(dateStr) || seenDates.has(dateStr)) return false;
            seenDates.add(dateStr);
            return true;
          })
          .map((p) => ({
            id: nanoid(),
            assetId: asset.id,
            price: p.price,
            recordedAt: p.date,
          }));

        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 500) {
            await db.insert(schema.priceHistory).values(rows.slice(i, i + 500));
          }
          updated++;
          console.log(`Backfilled ${rows.length} price points for ${asset.symbol}`);
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Backfill error for ${asset.symbol}:`, err);
        failed++;
      }
    }

    return { updated, skipped, failed };
  },
};
