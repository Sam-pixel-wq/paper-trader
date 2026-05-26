import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface RawNewsItem {
  uuid: string
  title: string
  publisher: string
  link: string
  providerPublishTime?: number
  thumbnail?: { resolutions?: { url: string; width: number }[] }
  relatedTickers?: string[]
  type?: string
}

interface NewsItem {
  id: string; title: string; publisher: string; url: string
  publishedAt: string | null; thumbnail: string | null; relatedTickers: string[]
}

async function fetchNewsForQuery(query: string): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=12&quotesCount=0&enableFuzzyQuery=false&enableNavLinks=false`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    next: { revalidate: 300 },
  })
  if (!res.ok) return []
  const json = await res.json()
  return ((json?.news ?? []) as RawNewsItem[])
    .filter(n => n.type !== 'STORY' || n.title) // skip empty
    .map(n => {
      // Pick the best thumbnail (prefer wider images)
      const resolutions = n.thumbnail?.resolutions ?? []
      const thumb = resolutions.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null
      return {
        id: n.uuid,
        title: n.title,
        publisher: n.publisher,
        url: n.link,
        publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
        thumbnail: thumb,
        relatedTickers: n.relatedTickers ?? [],
      }
    })
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = tickersParam ? tickersParam.split(',').filter(Boolean).slice(0, 4) : []

  try {
    const queries = ['stock market news today', ...tickers.map(t => `${t} stock`)]
    const results = await Promise.allSettled(queries.map(fetchNewsForQuery))

    // Merge + deduplicate by UUID, newest first
    const seen = new Set<string>()
    const merged: NewsItem[] = []
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      for (const item of result.value) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          merged.push(item)
        }
      }
    }

    merged.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    })

    return NextResponse.json(merged.slice(0, 30))
  } catch (err) {
    console.error('News error:', err)
    return NextResponse.json([])
  }
}
