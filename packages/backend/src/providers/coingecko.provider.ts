// CoinGecko free API - no API key required
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface CryptoQuote {
  id: string;
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
}

export interface CryptoSearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
}

// Common crypto ID mappings (symbol -> coingecko id)
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  XRP: 'ripple',
  USDC: 'usd-coin',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  XLM: 'stellar',
  ALGO: 'algorand',
  NEAR: 'near',
};

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export const coingeckoProvider = {
  getIdFromSymbol(symbol: string): string | undefined {
    return SYMBOL_TO_ID[symbol.toUpperCase()];
  },

  async getQuote(coinId: string, currency = 'usd'): Promise<CryptoQuote | null> {
    try {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const marketData = data.market_data;

      return {
        id: data.id,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        price: marketData.current_price[currency] || 0,
        currency: currency.toUpperCase(),
        change24h: marketData.price_change_24h || 0,
        changePercent24h: marketData.price_change_percentage_24h || 0,
        marketCap: marketData.market_cap[currency] || 0,
        volume24h: marketData.total_volume[currency] || 0,
      };
    } catch (error) {
      console.error(`CoinGecko quote error for ${coinId}:`, error);
      return null;
    }
  },

  async getQuoteBySymbol(symbol: string, currency = 'usd'): Promise<CryptoQuote | null> {
    const coinId = this.getIdFromSymbol(symbol);
    if (!coinId) {
      // Try searching for the coin
      const searchResults = await this.search(symbol);
      if (searchResults.length > 0) {
        return this.getQuote(searchResults[0].id, currency);
      }
      return null;
    }
    return this.getQuote(coinId, currency);
  },

  async getQuotes(coinIds: string[], currency = 'usd'): Promise<Map<string, CryptoQuote>> {
    const results = new Map<string, CryptoQuote>();

    try {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/markets?vs_currency=${currency}&ids=${coinIds.join(',')}&order=market_cap_desc&sparkline=false`
      );

      if (!response.ok) return results;

      const data = await response.json();

      for (const coin of data) {
        results.set(coin.id, {
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          price: coin.current_price || 0,
          currency: currency.toUpperCase(),
          change24h: coin.price_change_24h || 0,
          changePercent24h: coin.price_change_percentage_24h || 0,
          marketCap: coin.market_cap || 0,
          volume24h: coin.total_volume || 0,
        });
      }
    } catch (error) {
      console.error('CoinGecko batch quote error:', error);
    }

    return results;
  },

  async search(query: string): Promise<CryptoSearchResult[]> {
    try {
      const response = await fetchWithRetry(`${COINGECKO_API}/search?query=${encodeURIComponent(query)}`);

      if (!response.ok) return [];

      const data = await response.json();

      return (data.coins || []).slice(0, 10).map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        marketCapRank: coin.market_cap_rank,
      }));
    } catch (error) {
      console.error('CoinGecko search error:', error);
      return [];
    }
  },

  async getHistoricalPrices(
    coinId: string,
    days: number,
    currency = 'usd'
  ): Promise<{ date: Date; price: number }[]> {
    try {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=${currency}&days=${days}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (data.prices || []).map(([timestamp, price]: [number, number]) => ({
        date: new Date(timestamp),
        price,
      }));
    } catch (error) {
      console.error(`CoinGecko historical error for ${coinId}:`, error);
      return [];
    }
  },
};
