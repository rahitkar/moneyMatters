import YahooFinance from 'yahoo-finance2';
import { todayLocal } from '../lib/date.js';

const EXCHANGE_API = 'https://api.frankfurter.app';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  fetchedAt: string;
}

const rateCache = new Map<string, { rate: ExchangeRate; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — only refreshed explicitly via Refresh Prices

async function yahooFxRate(from: string, to: string): Promise<number | null> {
  const symbol = `${from.toUpperCase()}${to.toUpperCase()}=X`;
  try {
    const quote = await yf.quote(symbol);
    return quote?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

async function frankfurterRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${EXCHANGE_API}/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.[to.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

export const exchangeRateProvider = {
  async getRate(from: string, to: string): Promise<ExchangeRate | null> {
    const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
    const cached = rateCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rate;

    const today = todayLocal();

    // Yahoo Finance (live market rate) → fallback to frankfurter (ECB reference rate)
    let rate = await yahooFxRate(from, to);
    if (rate == null) {
      console.warn(`Yahoo FX unavailable for ${key}, falling back to frankfurter`);
      rate = await frankfurterRate(from, to);
    }
    if (rate == null) return null;

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
