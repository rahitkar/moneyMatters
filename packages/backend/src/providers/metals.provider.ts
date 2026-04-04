// Free metals price API - uses metals.live (no API key required)
const METALS_API = 'https://api.metals.live/v1';

export interface MetalQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  unit: string;
}

// Metal symbols mapping
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

export const metalsProvider = {
  async getSpotPrices(): Promise<Map<string, MetalQuote>> {
    const results = new Map<string, MetalQuote>();

    try {
      const response = await fetch(`${METALS_API}/spot`);
      if (!response.ok) {
        throw new Error(`Metals API error: ${response.status}`);
      }

      const data = await response.json();

      // metals.live returns array of objects with metal names and prices
      for (const item of data) {
        const symbol = item.metal?.toUpperCase();
        if (symbol && METAL_NAMES[symbol]) {
          results.set(symbol, {
            symbol,
            name: METAL_NAMES[symbol],
            price: item.price || 0,
            currency: 'USD',
            unit: 'oz', // per troy ounce
          });
        }
      }
    } catch (error) {
      console.error('Metals API error:', error);
      // Fallback: try alternative free API
      return this.getFallbackPrices();
    }

    return results;
  },

  async getFallbackPrices(): Promise<Map<string, MetalQuote>> {
    const results = new Map<string, MetalQuote>();

    // Fallback using a different free API or cached values
    // This is a simple fallback that returns approximate values
    // In production, you might want to use a different API
    const fallbackPrices: Record<string, number> = {
      GOLD: 2000,
      SILVER: 25,
      PLATINUM: 900,
      PALLADIUM: 1000,
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

    if (!metalKey) {
      return null;
    }

    const prices = await this.getSpotPrices();
    const standardSymbol = normalizedSymbol === 'XAU' ? 'GOLD' 
      : normalizedSymbol === 'XAG' ? 'SILVER'
      : normalizedSymbol === 'XPT' ? 'PLATINUM'
      : normalizedSymbol === 'XPD' ? 'PALLADIUM'
      : normalizedSymbol;

    return prices.get(standardSymbol) || null;
  },

  getSupportedSymbols(): string[] {
    return Object.keys(METAL_NAMES);
  },

  isMetalSymbol(symbol: string): boolean {
    return symbol.toUpperCase() in METAL_NAMES || symbol.toUpperCase() in SYMBOL_MAP;
  },
};
