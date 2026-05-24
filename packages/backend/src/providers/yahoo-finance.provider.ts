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

// Adaptive throttle: we increase the inter-request gap after a 429 and slowly
// recover. Yahoo's crumb endpoint is the most rate-limit-sensitive, so once we
// see a 429 we slow everything down rather than getting cascading failures.
const BASE_REQUEST_INTERVAL_MS = 600;
const MAX_REQUEST_INTERVAL_MS = 8_000;
const RATE_LIMIT_COOLDOWN_MS = 30_000;

let lastRequestTime = 0;
let currentInterval = BASE_REQUEST_INTERVAL_MS;
let cooldownUntil = 0;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many requests|failed to get crumb/i.test(msg);
}

function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b404\b|not found|no data found|no fundamentals data found/i.test(msg);
}

async function throttle(): Promise<void> {
  const now = Date.now();

  // If we're in a rate-limit cooldown, hold all callers behind it.
  if (cooldownUntil > now) {
    await delay(cooldownUntil - now);
  }

  const since = Date.now() - lastRequestTime;
  if (since < currentInterval) {
    await delay(currentInterval - since);
  }
  lastRequestTime = Date.now();
}

function noteRateLimited(): void {
  // Double the inter-request interval (capped) and force a cooldown window.
  currentInterval = Math.min(MAX_REQUEST_INTERVAL_MS, Math.max(currentInterval, BASE_REQUEST_INTERVAL_MS) * 2);
  cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

function noteSuccess(): void {
  // Decay the interval back toward baseline on each success.
  if (currentInterval > BASE_REQUEST_INTERVAL_MS) {
    currentInterval = Math.max(BASE_REQUEST_INTERVAL_MS, Math.floor(currentInterval * 0.75));
  }
}

// Some symbols are obviously not Yahoo tickers (full fund names, raw ISINs).
// Skipping these avoids burning crumb-endpoint budget on guaranteed 404s.
function isLikelyInvalidSymbol(symbol: string): boolean {
  if (!symbol) return true;
  const s = symbol.trim();
  if (s.length === 0) return true;
  // ISIN pattern: 12 chars starting with 2 letters + 9 alphanumerics + 1 digit. India MF ISINs start with INF.
  if (/^INF[A-Z0-9]{9}$/i.test(s)) return true;
  // Whitespace inside a symbol (e.g. "QUANT SMALL CAP FUND - DIRECT PLAN.NS") never resolves.
  if (/\s/.test(s)) return true;
  return false;
}

async function quoteViaChart(symbol: string): Promise<QuoteResult | null> {
  // /v8/finance/chart does not require a crumb, so it's our fallback when the
  // /v7 quote endpoint is rate-limited on the crumb fetch.
  const period1 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await yf.chart(
    symbol,
    { period1, interval: '1d' },
    { validateResult: false }
  );
  const meta = (result as { meta?: Record<string, unknown> } | undefined)?.meta;
  if (!meta) return null;

  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const change = price - prev;
  const changePercent = prev > 0 ? (change / prev) * 100 : 0;

  const rawTime = meta.regularMarketTime;
  const regularMarketTime =
    rawTime instanceof Date ? rawTime
      : typeof rawTime === 'number' ? new Date(rawTime * 1000)
      : undefined;

  return {
    symbol: typeof meta.symbol === 'string' ? meta.symbol : symbol,
    name: (typeof meta.shortName === 'string' && meta.shortName)
      || (typeof meta.longName === 'string' && meta.longName)
      || symbol,
    price,
    previousClose: Number.isFinite(prev) ? prev : undefined,
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    change,
    changePercent,
    volume: typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : undefined,
    regularMarketTime,
  };
}

export const yahooFinanceProvider = {
  async getQuote(symbol: string): Promise<QuoteResult | null> {
    if (isLikelyInvalidSymbol(symbol)) return null;

    // Try the regular /v7 quote endpoint first. On 429/crumb failure, fall back
    // to /v8 chart (no crumb needed) and let the caller continue.
    for (let attempt = 0; attempt < 2; attempt++) {
      await throttle();
      try {
        const quote = await yf.quote(symbol);
        if (!quote) return null;
        noteSuccess();
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
        if (isNotFoundError(error)) return null;

        if (isRateLimitError(error)) {
          noteRateLimited();
          // Try the chart fallback once before retrying the quote endpoint.
          try {
            const fallback = await quoteViaChart(symbol);
            if (fallback) {
              noteSuccess();
              return fallback;
            }
          } catch (chartErr) {
            if (isRateLimitError(chartErr)) noteRateLimited();
            // fall through to next attempt
          }
          // If we still have a retry budget, loop and try /v7 again after cooldown.
          if (attempt === 0) continue;
        }

        console.error(`Yahoo Finance quote error for ${symbol}:`, error);
        return null;
      }
    }
    return null;
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
      await throttle();
      const results = await yf.search(query, { quotesCount: 10 });
      noteSuccess();
      return (results.quotes || [])
        .filter((q): q is typeof q & { symbol: string } => !!q.symbol)
        .map((q) => ({
          symbol: q.symbol,
          name: String(('shortname' in q ? q.shortname : q.symbol) || q.symbol),
          type: String(('quoteType' in q ? q.quoteType : 'EQUITY') || 'EQUITY'),
          exchange: String(('exchange' in q ? q.exchange : '') || ''),
        }));
    } catch (error) {
      if (isRateLimitError(error)) noteRateLimited();
      console.error('Yahoo Finance search error:', error);
      return [];
    }
  },

  async getHistoricalPrices(
    symbol: string,
    period1: Date,
    period2: Date
  ): Promise<{ date: Date; close: number }[]> {
    if (isLikelyInvalidSymbol(symbol)) return [];
    try {
      await throttle();
      const result = await yf.historical(symbol, {
        period1,
        period2,
        interval: '1d',
      });
      noteSuccess();
      return result
        .filter((r) => r.close != null)
        .map((r) => ({
          date: r.date,
          close: r.close!,
        }));
    } catch (error: unknown) {
      if (isRateLimitError(error)) noteRateLimited();
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('null values')) {
        try {
          await throttle();
          const result: Array<{ date: Date; close: number | null }> = await yf.historical(
            symbol,
            { period1, period2, interval: '1d' },
            { validateResult: false }
          );
          noteSuccess();
          return result
            .filter((r) => r.close != null && r.close > 0)
            .map((r) => ({ date: r.date, close: r.close as number }));
        } catch (retryErr) {
          if (isRateLimitError(retryErr)) noteRateLimited();
        }
      }
      console.error(`Yahoo Finance historical error for ${symbol}:`, error);
      return [];
    }
  },
};
