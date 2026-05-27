import { NextResponse, type NextRequest } from 'next/server'
import { getMockStocks } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

const CATEGORIES: Record<string, { label: string; emoji: string; tickers: string[] }> = {
  trending:   { label: 'Trending',   emoji: '🔥', tickers: ['NVDA','TSLA','AAPL','META','AMZN','GOOGL','MSFT','AMD','NFLX','PLTR'] },
  tech:       { label: 'Technology', emoji: '💻', tickers: ['AAPL','MSFT','GOOGL','META','NVDA','AMD','INTC','CRM','ORCL','SNOW'] },
  finance:    { label: 'Finance',    emoji: '🏦', tickers: ['JPM','BAC','GS','MS','WFC','C','BLK','AXP','V','MA'] },
  healthcare: { label: 'Healthcare', emoji: '🏥', tickers: ['JNJ','PFE','UNH','ABBV','MRK','BMY','AMGN','GILD','LLY','MRNA'] },
  energy:     { label: 'Energy',     emoji: '⚡', tickers: ['XOM','CVX','COP','SLB','EOG','MPC','VLO','OXY','HAL','DVN'] },
  etfs:       { label: 'ETFs',       emoji: '📦', tickers: ['SPY','QQQ','DIA','IWM','VTI','GLD','TLT','ARKK','XLF','XLK'] },
}

interface StockRow {
  ticker: string; name: string; price: number
  change: number; changePct: number; volume: number
  marketCap?: number; sparkline: number[]
}

// In-memory cache keyed by sorted ticker list
const cache = new Map<string, { rows: StockRow[]; expires: number }>()
const CACHE_TTL = 60_000

async function fetchOneChart(ticker: string): Promise<StockRow | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null

    const json   = await res.json()
    const result = json?.chart?.result?.[0]
    const meta   = result?.meta
    if (!meta) return null

    const price: number = meta.regularMarketPrice
    if (price == null || Number.isNaN(price)) return null

    const prev: number | undefined = meta.chartPreviousClose
    const change    = typeof prev === 'number' ? price - prev : 0
    const changePct = typeof prev === 'number' && prev !== 0 ? (change / prev) * 100 : 0
    const rawCloses: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const sparkline = rawCloses.filter((c): c is number => c != null && !Number.isNaN(c))

    return {
      ticker,
      name:      (meta.longName || meta.shortName || ticker) as string,
      price,
      change,
      changePct,
      volume:    (meta.regularMarketVolume ?? 0) as number,
      marketCap: meta.marketCap as number | undefined,
      sparkline,
    }
  } catch {
    return null
  }
}

async function batchFetch(tickers: string[]): Promise<StockRow[]> {
  const cacheKey = tickers.join(',')
  const cached   = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.rows

  // Try live Yahoo Finance first
  const results = await Promise.allSettled(tickers.map(fetchOneChart))
  const rows = results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is StockRow => r !== null)

  if (rows.length >= tickers.length * 0.5) {
    // Enough real data came back — use it
    cache.set(cacheKey, { rows, expires: Date.now() + CACHE_TTL })
    return rows
  }

  // Fall back to mock data for all tickers
  const mock = getMockStocks(tickers)
  cache.set(cacheKey, { rows: mock, expires: Date.now() + CACHE_TTL })
  return mock
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get('tickers')
  const category     = req.nextUrl.searchParams.get('category') ?? 'trending'

  const tickers = tickersParam
    ? tickersParam.split(',').map(t => t.trim().toUpperCase()).slice(0, 12)
    : (CATEGORIES[category] ?? CATEGORIES.trending).tickers

  try {
    return NextResponse.json(await batchFetch(tickers))
  } catch (err) {
    console.error('Stocks error:', err)
    return NextResponse.json(getMockStocks(tickers))
  }
}
