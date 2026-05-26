import yahooFinance from 'yahoo-finance2'

yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical'])

type QuoteData = Record<string, unknown>

const quoteCache = new Map<string, { data: QuoteData; expires: number }>()
const CACHE_MS = 90_000   // 90 s — short enough to reflect market moves, long enough to avoid rate limits
const MIN_GAP_MS = 350

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function isRateLimited(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('Too Many Requests')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn) as Promise<T>
  queue = run.catch(() => {})
  return run
}

async function throttle() {
  const wait = MIN_GAP_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

function parseQuote(symbol: string, quote: unknown): QuoteData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quote as any
  const price = q.regularMarketPrice as number | undefined
  if (price == null || Number.isNaN(price)) {
    throw new Error('No price available for this symbol')
  }
  return {
    ticker: symbol,
    name: (q.longName || q.shortName || symbol) as string,
    price,
    change: q.regularMarketChange as number | undefined,
    changePct: q.regularMarketChangePercent as number | undefined,
    open: q.regularMarketOpen as number | undefined,
    high: q.regularMarketDayHigh as number | undefined,
    low: q.regularMarketDayLow as number | undefined,
    volume: q.regularMarketVolume as number | undefined,
    marketCap: q.marketCap as number | undefined,
    pe: q.trailingPE as number | undefined,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh as number | undefined,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow as number | undefined,
  }
}

async function requestQuote(symbol: string): Promise<QuoteData> {
  await throttle()
  const quote = await yahooFinance.quote(
    symbol,
    {},
    { validateResult: false } as Parameters<typeof yahooFinance.quote>[2]
  )
  const data = parseQuote(symbol, quote)
  quoteCache.set(symbol, { data, expires: Date.now() + CACHE_MS })
  return data
}

export async function fetchQuote(ticker: string) {
  const symbol = ticker.trim().toUpperCase()
  if (!symbol) throw new Error('Invalid ticker')

  const cached = quoteCache.get(symbol)
  if (cached && cached.expires > Date.now()) return cached.data

  return enqueue(async () => {
    try {
      return await requestQuote(symbol)
    } catch (error) {
      if (isRateLimited(error)) {
        const stale = quoteCache.get(symbol)
        if (stale) return stale.data
        await sleep(2000)
        try {
          return await requestQuote(symbol)
        } catch (retryError) {
          const staleAfterRetry = quoteCache.get(symbol)
          if (staleAfterRetry) return staleAfterRetry.data
          throw retryError
        }
      }
      throw error
    }
  })
}

export async function searchSymbols(query: string) {
  return enqueue(async () => {
    await throttle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await yahooFinance.search(query, { newsCount: 0, quotesCount: 8 } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((results as any).quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.quoteType === 'EQUITY' || r.quoteType === 'ETF')
      .slice(0, 6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        ticker: r.symbol,
        name: r.longname || r.shortname || r.symbol,
        exchange: r.exchange,
        type: r.quoteType,
      }))
  })
}

export function yahooErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (isRateLimited(error)) {
    return 'Market data is busy. Wait a few seconds and try again.'
  }
  if (msg.includes('Not Found') || msg.includes('No data')) {
    return 'Symbol not found. Try a different ticker.'
  }
  return 'Could not load market data. Please try again.'
}
