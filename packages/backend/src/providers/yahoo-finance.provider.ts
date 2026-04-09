import YahooFinance from 'yahoo-finance2';

export interface QuoteResult {
  symbol: string;
  name: string;
  price: number;
  previousClose?: number;
  currency: string;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
  regularMarketTime?: Date;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 600;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export const yahooFinanceProvider = {
  async getQuote(symbol: string): Promise<QuoteResult | null> {
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }
      lastRequestTime = Date.now();

      const quote = await yf.quote(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        name: quote.shortName || quote.longName || symbol,
        price: quote.regularMarketPrice || 0,
        previousClose: quote.regularMarketPreviousClose ?? undefined,
        currency: quote.currency || 'USD',
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        marketCap: quote.marketCap,
        volume: quote.regularMarketVolume,
        regularMarketTime: quote.regularMarketTime,
      };
    } catch (error) {
      console.error(`Yahoo Finance quote error for ${symbol}:`, error);
      return null;
    }
  },

  async getQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
    const results = new Map<string, QuoteResult>();

    for (const symbol of symbols) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        results.set(symbol, quote);
      }
    }

    return results;
  },

  async search(query: string): Promise<SearchResult[]> {
    try {
      const results = await yf.search(query, { quotesCount: 10 });
      return (results.quotes || [])
        .filter((q): q is typeof q & { symbol: string } => !!q.symbol)
        .map((q) => ({
          symbol: q.symbol,
          name: String(('shortname' in q ? q.shortname : q.symbol) || q.symbol),
          type: String(('quoteType' in q ? q.quoteType : 'EQUITY') || 'EQUITY'),
          exchange: String(('exchange' in q ? q.exchange : '') || ''),
        }));
    } catch (error) {
      console.error('Yahoo Finance search error:', error);
      return [];
    }
  },

  async getHistoricalPrices(
    symbol: string,
    period1: Date,
    period2: Date
  ): Promise<{ date: Date; close: number }[]> {
    try {
      const result = await yf.historical(symbol, {
        period1,
        period2,
        interval: '1d',
      });

      return result.map((r) => ({
        date: r.date,
        close: r.close || 0,
      }));
    } catch (error) {
      console.error(`Yahoo Finance historical error for ${symbol}:`, error);
      return [];
    }
  },
};
