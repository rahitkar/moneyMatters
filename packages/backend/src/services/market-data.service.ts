import { yahooFinanceProvider } from '../providers/yahoo-finance.provider.js';
import { coingeckoProvider } from '../providers/coingecko.provider.js';
import { metalsProvider } from '../providers/metals.provider.js';
import { exchangeRateProvider } from '../providers/exchange-rate.provider.js';
import { indiaMfNavProvider } from '../providers/india-mf-nav.provider.js';
import { assetService } from './asset.service.js';
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
    case 'silver':
    case 'metals':
      return 'metals_api';
    case 'ppf':
    case 'epf':
    case 'nps':
    case 'fixed_deposit':
    case 'lended':
    case 'cash':
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
      const symbols = yahooAssets.map((a) => a.symbol);
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
      for (const asset of metalAssets) {
        const quote = metalPrices.get(asset.symbol);
        if (quote) {
          await assetService.updatePrice(asset.id, quote.price);
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
};
