import { fetchQuote as fetchQuoteYahoo, searchSymbols as searchSymbolsYahoo, yahooErrorMessage } from './yahoo'

export { yahooErrorMessage }

// Direct REST fallback for search — used when yahoo-finance2 is rate-limited
async function searchSymbolsDirect(query: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0&enableFuzzyQuery=false&enableNavLinks=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((json?.quotes ?? []) as any[])
    .filter(r => r.quoteType === 'EQUITY' || r.quoteType === 'ETF')
    .slice(0, 6)
    .map(r => ({
      ticker: r.symbol as string,
      name: (r.longname || r.shortname || r.symbol) as string,
      exchange: r.exchange as string,
      type: r.quoteType as string,
    }))
}

export async function searchSymbols(query: string) {
  try {
    return await searchSymbolsYahoo(query)
  } catch {
    return await searchSymbolsDirect(query)
  }
}

type QuoteData = Record<string, unknown>

const chartCache = new Map<string, { data: QuoteData; expires: number }>()
const CHART_CACHE_MS = 90_000   // match yahoo.ts cache so both paths stay in sync

/** Lightweight Yahoo chart endpoint — used when yahoo-finance2 is rate-limited */
async function fetchQuoteChart(symbol: string): Promise<QuoteData> {
  const cached = chartCache.get(symbol)
  if (cached && cached.expires > Date.now()) return cached.data

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',   // always fetch fresh — never use Next.js data-cache
  })

  if (!res.ok) throw new Error(`Chart API ${res.status}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const meta = result?.meta
  const price = meta?.regularMarketPrice as number | undefined
  if (price == null || Number.isNaN(price)) {
    throw new Error('No price in chart response')
  }

  const prev = meta.chartPreviousClose ?? meta.previousClose
  const change = typeof prev === 'number' ? price - prev : undefined
  const changePct = typeof prev === 'number' && prev !== 0 ? (change! / prev) * 100 : undefined

  const data: QuoteData = {
    ticker: symbol,
    name: (meta.longName || meta.shortName || symbol) as string,
    price,
    change,
    changePct,
    open: meta.regularMarketOpen,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    marketCap: meta.marketCap,
    pe: undefined,
    fiftyTwoWeekHigh: undefined,
    fiftyTwoWeekLow: undefined,
  }

  chartCache.set(symbol, { data, expires: Date.now() + CHART_CACHE_MS })
  return data
}

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  const symbol = ticker.trim().toUpperCase()
  if (!symbol) throw new Error('Invalid ticker')

  try {
    return await fetchQuoteYahoo(symbol)
  } catch (yahooError) {
    try {
      return await fetchQuoteChart(symbol)
    } catch {
      throw yahooError
    }
  }
}

export async function fetchHistory(ticker: string, period: string) {
  const symbol = ticker.trim().toUpperCase()
  const isIntraday = period === '1d'

  const interval = isIntraday ? '5m'
    : period === '1y' || period === '5y' ? '1wk' : '1d'
  const range = isIntraday ? '1d'
    : period === '1w' ? '5d' : period === '1mo' ? '1mo'
    : period === '3mo' ? '3mo' : period === '1y' ? '1y' : '5y'

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',   // always fresh — in-memory chartCache handles throttling
  })
  if (!res.ok) return []

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamp ?? []
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
  const prevClose: number | undefined = result.meta?.chartPreviousClose

  return timestamps
    .map((ts, i) => {
      const close = closes[i]
      if (close == null || Number.isNaN(close)) return null
      const date = isIntraday
        ? new Date(ts * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'America/New_York',
          })
        : new Date(ts * 1000).toISOString().slice(0, 10)
      return { date, close, prevClose: isIntraday ? prevClose : undefined }
    })
    .filter((d): d is { date: string; close: number; prevClose: number | undefined } => d !== null)
}
