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
const MAX_REQUEST_INTERVAL_MS = 4_000;
const RATE_LIMIT_COOLDOWN_MS = 15_000;

// "Chart-first mode": once we've seen a crumb 429 in this process lifetime,
// flip a sticky flag. The /v8 chart endpoint doesn't need a crumb, so for
// the rest of the lifetime we go chart-first and fall back to /v7 only if
// chart fails. This dramatically reduces 429s in long-lived processes
// (e.g. Render web services) where Yahoo has decided our IP is hot.
// Reset on any successful /v7 quote, in case Yahoo cools off.
let preferChartFirst = false;

let lastRequestTime = 0;
let currentInterval = BASE_REQUEST_INTERVAL_MS;
let cooldownUntil = 0;

// `ripHistorical`: yahoo-finance2 v3 deprecated historical() in favour of
// chart(). We've migrated `getHistoricalPrices` below to use chart()
// directly, but the suppression also covers any indirect transitive uses.
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

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

function noteRateLimited(viaCrumb = false): void {
  // Double the inter-request interval (capped) and force a cooldown window.
  currentInterval = Math.min(MAX_REQUEST_INTERVAL_MS, Math.max(currentInterval, BASE_REQUEST_INTERVAL_MS) * 2);
  cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  // A crumb-endpoint 429 is the strongest signal that we should stop
  // hitting /v7 and use /v8 chart for the rest of this process lifetime.
  if (viaCrumb) preferChartFirst = true;
}

function noteSuccess(viaQuoteEndpoint = false): void {
  // Decay the interval back toward baseline on each success.
  if (currentInterval > BASE_REQUEST_INTERVAL_MS) {
    currentInterval = Math.max(BASE_REQUEST_INTERVAL_MS, Math.floor(currentInterval * 0.75));
  }
  // If a /v7 quote actually succeeded, Yahoo is friendly again — turn off
  // the sticky chart-first flag so we can use the richer /v7 payload.
  if (viaQuoteEndpoint) preferChartFirst = false;
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

  // Prefer regularMarketPreviousClose (yesterday's actual session close) over
  // chartPreviousClose, which is the close *before* the chart window starts —
  // for a 7-day window that's ~8 days ago, not yesterday, producing wrong day change.
  const prev = Number(
    meta.regularMarketPreviousClose ??
    meta.previousClose ??
    meta.chartPreviousClose ??
    price
  );
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

async function quoteViaQuoteEndpoint(symbol: string): Promise<QuoteResult | null> {
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
}

export const yahooFinanceProvider = {
  async getQuote(symbol: string): Promise<QuoteResult | null> {
    if (isLikelyInvalidSymbol(symbol)) return null;

    // Order of preference:
    //   - Default: /v7 quote first (richer payload), /v8 chart on 429.
    //   - After we've seen a crumb 429 this process: /v8 chart first
    //     (no crumb needed, way more tolerant), /v7 only if chart fails.
    const tryQuote = async (): Promise<QuoteResult | null> => {
      await throttle();
      try {
        const result = await quoteViaQuoteEndpoint(symbol);
        if (result) noteSuccess(true);
        return result;
      } catch (error) {
        if (isNotFoundError(error)) return null;
        if (isRateLimitError(error)) {
          noteRateLimited(/* viaCrumb */ true);
        }
        throw error;
      }
    };

    const tryChart = async (): Promise<QuoteResult | null> => {
      await throttle();
      try {
        const result = await quoteViaChart(symbol);
        if (result) noteSuccess();
        return result;
      } catch (error) {
        if (isNotFoundError(error)) return null;
        if (isRateLimitError(error)) noteRateLimited();
        throw error;
      }
    };

    const order = preferChartFirst ? [tryChart, tryQuote] : [tryQuote, tryChart];
    let lastError: unknown = null;

    for (const fn of order) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (error) {
        lastError = error;
        // Keep going to the next strategy. If both fail, we'll log once below.
      }
    }

    if (lastError && !isNotFoundError(lastError) && !isRateLimitError(lastError)) {
      console.error(`Yahoo Finance quote error for ${symbol}:`, lastError);
    } else if (isRateLimitError(lastError)) {
      // Both endpoints rate-limited. Log once with low noise so a long
      // refresh during a Yahoo squeeze doesn't spam the same stack 50x.
      console.warn(`Yahoo rate-limited on both /v7 and /v8 for ${symbol}; skipping`);
    }
    return null;
  },

  async getQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
    const results = new Map<string, QuoteResult>();
    const total = symbols.length;
    // Periodic progress so a long refresh doesn't look hung. Every 25
    // symbols (or whenever the throttle has visibly stretched) we log a
    // heartbeat. Use console.log so it shows up alongside Pino lines.
    const PROGRESS_EVERY = 25;
    let done = 0;
    let lastLoggedAt = 0;

    for (const symbol of symbols) {
      const quote = await this.getQuote(symbol);
      if (quote) results.set(symbol, quote);
      done++;
      if (done % PROGRESS_EVERY === 0 || done === total) {
        const now = Date.now();
        // Avoid double-logging when symbols evaporate quickly from cache hits.
        if (now - lastLoggedAt > 1000 || done === total) {
          console.log(`Yahoo quotes progress: ${done}/${total} (interval=${currentInterval}ms${preferChartFirst ? ', chart-first' : ''})`);
          lastLoggedAt = now;
        }
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

    // Use /v8 chart directly (instead of the deprecated historical() which
    // yahoo-finance2 internally maps to chart() anyway). Chart doesn't
    // require a crumb, so historical pulls don't burn our crumb budget.
    // `validateResult: false` lets through rows with null OHLC values
    // (common for non-trading days or split-adjusted gaps); we filter
    // those out below.
    try {
      await throttle();
      const result = await yf.chart(
        symbol,
        { period1, period2, interval: '1d' },
        { validateResult: false },
      );
      noteSuccess();
      const quotes = (result as { quotes?: Array<{ date: Date; close: number | null }> } | undefined)?.quotes ?? [];
      return quotes
        .filter((r) => r.close != null && r.close > 0)
        .map((r) => ({ date: r.date, close: r.close as number }));
    } catch (error) {
      if (isNotFoundError(error)) return [];
      if (isRateLimitError(error)) {
        noteRateLimited();
        console.warn(`Yahoo rate-limited on chart for ${symbol}; skipping historical`);
        return [];
      }
      console.error(`Yahoo Finance historical error for ${symbol}:`, error);
      return [];
    }
  },
};
