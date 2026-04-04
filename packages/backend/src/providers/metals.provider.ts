import { yahooFinanceProvider } from './yahoo-finance.provider.js';

export interface MetalQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  unit: string;
}

const METAL_NAMES: Record<string, string> = {
  GOLD: 'Gold',
  SILVER: 'Silver',
  PLATINUM: 'Platinum',
  PALLADIUM: 'Palladium',
  XAU: 'Gold',
  XAG: 'Silver',
  XPT: 'Platinum',
  XPD: 'Palladium',
};

const SYMBOL_MAP: Record<string, string> = {
  GOLD: 'gold',
  XAU: 'gold',
  SILVER: 'silver',
  XAG: 'silver',
  PLATINUM: 'platinum',
  XPT: 'platinum',
  PALLADIUM: 'palladium',
  XPD: 'palladium',
};

// Yahoo Finance futures symbols for metals
const YAHOO_METAL_SYMBOLS: Record<string, string> = {
  GOLD: 'GC=F',
  SILVER: 'SI=F',
  PLATINUM: 'PL=F',
  PALLADIUM: 'PA=F',
};

const METALS_API = 'https://api.metals.live/v1';

export const metalsProvider = {
  /**
   * Primary: Yahoo Finance commodity futures (GC=F, SI=F, etc.)
   * Fallback 1: metals.live API
   * Fallback 2: hardcoded recent prices
   */
  async getSpotPrices(): Promise<Map<string, MetalQuote>> {
    // Try Yahoo Finance first (most reliable)
    const results = await this.getYahooFinancePrices();
    if (results.size > 0) return results;

    // Fallback to metals.live
    try {
      const mlResults = await this.getMetalsLivePrices();
      if (mlResults.size > 0) return mlResults;
    } catch {
      // Fall through to hardcoded fallback
    }

    return this.getFallbackPrices();
  },

  async getYahooFinancePrices(): Promise<Map<string, MetalQuote>> {
    const results = new Map<string, MetalQuote>();

    for (const [metal, yfSymbol] of Object.entries(YAHOO_METAL_SYMBOLS)) {
      try {
        const quote = await yahooFinanceProvider.getQuote(yfSymbol);
        if (quote && quote.price > 0) {
          results.set(metal, {
            symbol: metal,
            name: METAL_NAMES[metal],
            price: quote.price,
            currency: 'USD',
            unit: 'oz',
          });
        }
      } catch (error) {
        console.error(`Yahoo Finance metal quote error for ${metal} (${yfSymbol}):`, error);
      }
    }

    return results;
  },

  async getMetalsLivePrices(): Promise<Map<string, MetalQuote>> {
    const results = new Map<string, MetalQuote>();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${METALS_API}/spot`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Metals API error: ${response.status}`);

      const data = await response.json();
      for (const item of data) {
        const symbol = item.metal?.toUpperCase();
        if (symbol && METAL_NAMES[symbol]) {
          results.set(symbol, {
            symbol,
            name: METAL_NAMES[symbol],
            price: item.price || 0,
            currency: 'USD',
            unit: 'oz',
          });
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error('Metals.live API error:', error);
    }

    return results;
  },

  async getFallbackPrices(): Promise<Map<string, MetalQuote>> {
    const results = new Map<string, MetalQuote>();

    // Approximate prices as of early 2026 — only used when both APIs fail
    const fallbackPrices: Record<string, number> = {
      GOLD: 4700,
      SILVER: 55,
      PLATINUM: 1100,
      PALLADIUM: 1100,
    };

    for (const [symbol, price] of Object.entries(fallbackPrices)) {
      results.set(symbol, {
        symbol,
        name: METAL_NAMES[symbol],
        price,
        currency: 'USD',
        unit: 'oz',
      });
    }

    return results;
  },

  async getQuote(symbol: string): Promise<MetalQuote | null> {
    const normalizedSymbol = symbol.toUpperCase();
    const metalKey = SYMBOL_MAP[normalizedSymbol];
    if (!metalKey) return null;

    const standardSymbol = normalizedSymbol === 'XAU' ? 'GOLD'
      : normalizedSymbol === 'XAG' ? 'SILVER'
      : normalizedSymbol === 'XPT' ? 'PLATINUM'
      : normalizedSymbol === 'XPD' ? 'PALLADIUM'
      : normalizedSymbol;

    const prices = await this.getSpotPrices();
    return prices.get(standardSymbol) || null;
  },

  getSupportedSymbols(): string[] {
    return Object.keys(METAL_NAMES);
  },

  isMetalSymbol(symbol: string): boolean {
    return symbol.toUpperCase() in METAL_NAMES || symbol.toUpperCase() in SYMBOL_MAP;
  },
};
