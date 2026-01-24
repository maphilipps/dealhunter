/**
 * Yahoo Finance Integration
 *
 * Free stock data API (unofficial, no API key required)
 * Provides real-time and historical stock prices
 */

export interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  currency?: string;
  exchange?: string;
  shortName?: string;
  longName?: string;
}

export interface StockData {
  currentPrice?: number;
  currency?: string;
  priceChange30d?: number;
  priceChange1y?: number;
  marketCap?: string;
  exchange?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

/**
 * Fetch stock quote from Yahoo Finance
 * Uses unofficial v7 API endpoint (no authentication required)
 */
export async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`Yahoo Finance API error for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const quote = data?.quoteResponse?.result?.[0];

    if (!quote) {
      return null;
    }

    return {
      symbol: quote.symbol,
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
      regularMarketDayHigh: quote.regularMarketDayHigh,
      regularMarketDayLow: quote.regularMarketDayLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      marketCap: quote.marketCap,
      currency: quote.currency,
      exchange: quote.fullExchangeName || quote.exchange,
      shortName: quote.shortName,
      longName: quote.longName,
    };
  } catch (error) {
    console.error(`Failed to fetch Yahoo Finance data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch historical data for price change calculations
 */
export async function fetchHistoricalPrice(
  symbol: string,
  daysAgo: number
): Promise<number | null> {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - daysAgo * 24 * 60 * 60;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];

    if (!quotes?.close || quotes.close.length === 0) {
      return null;
    }

    // Get first non-null close price
    const historicalPrice = quotes.close.find((price: number | null) => price !== null);
    return historicalPrice || null;
  } catch (error) {
    console.error(`Failed to fetch historical data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Format market cap into human-readable string
 */
function formatMarketCap(marketCap: number, currency: string): string {
  if (marketCap >= 1e12) {
    return `${(marketCap / 1e12).toFixed(2)}T ${currency}`;
  }
  if (marketCap >= 1e9) {
    return `${(marketCap / 1e9).toFixed(2)}B ${currency}`;
  }
  if (marketCap >= 1e6) {
    return `${(marketCap / 1e6).toFixed(2)}M ${currency}`;
  }
  return `${marketCap.toLocaleString()} ${currency}`;
}

/**
 * Get comprehensive stock data with price changes
 */
export async function getStockData(symbol: string): Promise<StockData | null> {
  try {
    // Fetch current quote and historical prices in parallel
    const [quote, price30d, price1y] = await Promise.all([
      fetchYahooQuote(symbol),
      fetchHistoricalPrice(symbol, 30),
      fetchHistoricalPrice(symbol, 365),
    ]);

    if (!quote || quote.regularMarketPrice === undefined) {
      return null;
    }

    const currentPrice = quote.regularMarketPrice;

    // Calculate price changes
    const priceChange30d =
      price30d && currentPrice ? ((currentPrice - price30d) / price30d) * 100 : undefined;

    const priceChange1y =
      price1y && currentPrice ? ((currentPrice - price1y) / price1y) * 100 : undefined;

    return {
      currentPrice,
      currency: quote.currency,
      priceChange30d,
      priceChange1y,
      marketCap:
        quote.marketCap && quote.currency
          ? formatMarketCap(quote.marketCap, quote.currency)
          : undefined,
      exchange: quote.exchange,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
    };
  } catch (error) {
    console.error(`Failed to get stock data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Search for stock symbol by company name
 * Uses Yahoo Finance search endpoint
 */
export async function searchStockSymbol(companyName: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=5&newsCount=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const quotes = data?.quotes || [];

    // Prefer equity quotes over others
    const equityQuote = quotes.find((q: any) => q.quoteType === 'EQUITY' && q.isYahooFinance);

    if (equityQuote) {
      return equityQuote.symbol;
    }

    // Fallback to first result
    return quotes[0]?.symbol || null;
  } catch (error) {
    console.error(`Failed to search stock symbol for ${companyName}:`, error);
    return null;
  }
}
