'use client'
import { useEffect, useState, useCallback } from 'react'
import { Newspaper, ExternalLink, RefreshCw, TrendingUp } from 'lucide-react'
import NewsModal from './NewsModal'
import TradePanel from './TradePanel'

interface NewsItem {
  id: string; title: string; publisher: string; url: string
  publishedAt: string | null; thumbnail: string | null; relatedTickers: string[]
}

interface QuoteData {
  ticker: string; name: string; price: number; change: number; changePct: number
  open: number; high: number; low: number; volume: number
  marketCap: number; pe: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number
}

interface Position { ticker: string; shares: number }

interface Props {
  holdingTickers: string[]
  playerId: number
  cash: number
  positions: Position[]
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

type Tab = 'markets' | 'portfolio'

export default function NewsTab({ holdingTickers, playerId, cash, positions }: Props) {
  const [tab, setTab] = useState<Tab>('markets')
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  const [tradeQuote, setTradeQuote] = useState<QuoteData | null>(null)
  const [loadingTrade, setLoadingTrade] = useState(false)

  const load = useCallback(async (activeTab: Tab) => {
    setLoading(true)
    try {
      const tickers = activeTab === 'portfolio' ? holdingTickers.slice(0, 4) : []
      const params = tickers.length ? `?tickers=${tickers.join(',')}` : ''
      const res = await fetch(`/api/news${params}`)
      setNews(await res.json())
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [holdingTickers])

  useEffect(() => { load(tab) }, [tab, load])

  // Called from NewsModal when user taps "Trade [TICKER]"
  async function handleTradeFromNews(ticker: string) {
    setSelectedArticle(null)
    setLoadingTrade(true)
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(ticker)}`)
      const q = await res.json()
      if (res.ok && q.price != null) setTradeQuote(q)
    } finally {
      setLoadingTrade(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={20} className="text-indigo-400" />
          <h2 className="text-lg font-bold">Market News</h2>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              · {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={() => load(tab)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('markets')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'markets'
              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
              : 'border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          📰 Markets
        </button>
        <button
          onClick={() => setTab('portfolio')}
          disabled={holdingTickers.length === 0}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === 'portfolio'
              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
              : 'border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          📊 My Stocks {holdingTickers.length > 0 && `(${holdingTickers.length})`}
        </button>
      </div>

      {/* Loading trade spinner */}
      {loadingTrade && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400" />
            <span className="text-sm text-gray-300">Loading quote…</span>
          </div>
        </div>
      )}

      {/* News grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="bg-gray-800 rounded-lg h-32 mb-3" />
              <div className="bg-gray-800 rounded h-4 mb-2" />
              <div className="bg-gray-800 rounded h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Newspaper size={36} className="mb-3 opacity-20" />
          <p className="text-sm">
            {tab === 'portfolio' && holdingTickers.length === 0
              ? 'Buy some stocks first to see news about your holdings.'
              : 'No news available right now. Try refreshing.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedArticle(item)}
              className="group bg-gray-900 border border-gray-800 hover:border-indigo-700/60 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-950/30 flex flex-col cursor-pointer"
            >
              {/* Thumbnail */}
              {item.thumbnail ? (
                <div className="h-36 overflow-hidden bg-gray-800 flex-shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail} alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                  />
                  {/* Trade overlay hint */}
                  <div className="absolute inset-0 bg-indigo-950/0 group-hover:bg-indigo-950/20 transition-colors flex items-center justify-center">
                    {item.relatedTickers.length > 0 && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/90 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                        Trade Related Stocks →
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-24 bg-gradient-to-br from-indigo-950/60 to-gray-800 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={28} className="text-indigo-700" />
                </div>
              )}

              {/* Content */}
              <div className="p-4 flex flex-col flex-1">
                <p className="text-sm font-medium text-gray-100 leading-snug group-hover:text-white transition-colors line-clamp-3 flex-1">
                  {item.title}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-xs text-indigo-400 font-medium">{item.publisher}</span>
                    {item.publishedAt && (
                      <span className="text-xs text-gray-500 ml-2">{timeAgo(item.publishedAt)}</span>
                    )}
                  </div>
                  {/* External link — doesn't open the modal */}
                  <a
                    href={item.url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-gray-600 hover:text-indigo-400 transition-colors p-1 flex-shrink-0"
                    title="Open article"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                {item.relatedTickers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.relatedTickers.slice(0, 4).map(t => (
                      <span key={t} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono group-hover:bg-indigo-950/60 group-hover:text-indigo-300 transition-colors">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* News article modal */}
      {selectedArticle && (
        <NewsModal
          article={selectedArticle}
          playerId={playerId}
          cash={cash}
          positions={positions}
          onClose={() => setSelectedArticle(null)}
          onTrade={handleTradeFromNews}
        />
      )}

      {/* Trade panel (opened from news modal) */}
      {tradeQuote && (
        <TradePanel
          quote={tradeQuote}
          playerId={playerId}
          cash={cash}
          existingShares={positions.find(p => p.ticker === tradeQuote.ticker)?.shares ?? 0}
          onClose={() => setTradeQuote(null)}
          onTradeComplete={() => setTradeQuote(null)}
        />
      )}
    </div>
  )
}
