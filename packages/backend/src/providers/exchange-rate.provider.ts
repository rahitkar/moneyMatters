import { todayLocal } from '../lib/date.js';
import { yahooFinanceProvider } from './yahoo-finance.provider.js';

const EXCHANGE_API = 'https://api.frankfurter.app';

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  fetchedAt: string;
}

const rateCache = new Map<string, { rate: ExchangeRate; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Short-lived "negative cache" — when both Yahoo and Frankfurter fail to
// answer for a currency pair, remember that for ~60s. This stops a tight
// loop of consumers (e.g. portfolio recompute over many holdings) from
// hammering both upstreams during an outage.
const negativeCache = new Map<string, number>();
const NEGATIVE_TTL_MS = 60_000;

const inflight = new Map<string, Promise<ExchangeRate | null>>();

async function yahooFxRate(from: string, to: string): Promise<number | null> {
  // Route through the throttled provider so FX calls share the same crumb
  // budget, exponential backoff, and chart-endpoint fallback as equity
  // quotes. Previously this used a raw `yf.quote()` which bypassed all of
  // that and 429'd into the void.
  const symbol = `${from.toUpperCase()}${to.toUpperCase()}=X`;
  const quote = await yahooFinanceProvider.getQuote(symbol);
  return quote?.price ?? null;
}

async function frankfurterRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${EXCHANGE_API}/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.[to.toUpperCase()] ?? null;
  } catch (err) {
    console.warn(
      `Frankfurter FX error for ${from}->${to}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export const exchangeRateProvider = {
  async getRate(from: string, to: string): Promise<ExchangeRate | null> {
    const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
    const cached = rateCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rate;

    // Negative cache: if both upstreams just failed for this pair, don't
    // retry until the short TTL elapses.
    const negTs = negativeCache.get(key);
    if (negTs != null && Date.now() - negTs < NEGATIVE_TTL_MS) return null;

    if (inflight.has(key)) return inflight.get(key)!;

    const promise = this._fetchRate(from, to, key);
    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  },

  async _fetchRate(from: string, to: string, key: string): Promise<ExchangeRate | null> {
    const today = todayLocal();

    let rate = await yahooFxRate(from, to);
    if (rate == null) {
      // Yahoo failed (rate-limited, blocked, or upstream down). Frankfurter
      // is a free ECB-backed FX API with no auth or quota — a good fallback.
      rate = await frankfurterRate(from, to);
    }
    if (rate == null) {
      console.warn(`FX unavailable for ${key} from both Yahoo and Frankfurter; caching negative for ${NEGATIVE_TTL_MS / 1000}s`);
      negativeCache.set(key, Date.now());
      return null;
    }

    // Successful fetch invalidates any prior negative cache entry.
    negativeCache.delete(key);

    const result: ExchangeRate = {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate,
      date: today,
      fetchedAt: new Date().toISOString(),
    };
    rateCache.set(key, { rate: result, ts: Date.now() });
    return result;
  },

  async getRates(from: string, toCurrencies: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    for (const to of toCurrencies) {
      const r = await this.getRate(from, to);
      if (r) results.set(to.toUpperCase(), r.rate);
    }
    return results;
  },

  async convertAmount(
    amount: number,
    from: string,
    to: string
  ): Promise<number | null> {
    const rate = await this.getRate(from, to);
    if (!rate) return null;
    return amount * rate.rate;
  },

  async getHistoricalRate(
    from: string,
    to: string,
    date: string
  ): Promise<ExchangeRate | null> {
    try {
      const response = await fetch(
        `${EXCHANGE_API}/${date}?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
      );

      if (!response.ok) return null;

      const data = await response.json();

      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: data.rates[to.toUpperCase()] || 0,
        date: data.date,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Historical exchange rate error:`, error);
      return null;
    }
  },

  invalidateRate(from: string, to: string): void {
    rateCache.delete(`${from.toUpperCase()}_${to.toUpperCase()}`);
  },

  getSupportedCurrencies(): string[] {
    return [
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN',
      'BRL', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'NZD', 'ZAR', 'RUB',
    ];
  },
};
