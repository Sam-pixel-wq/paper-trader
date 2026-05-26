'use client'
import { useEffect, useState } from 'react'
import { X, ExternalLink, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'

interface NewsItem {
  id: string; title: string; publisher: string; url: string
  publishedAt: string | null; thumbnail: string | null; relatedTickers: string[]
}

interface StockQuote {
  ticker: string; name: string; price: number; change: number; changePct: number
}

interface Position { ticker: string; shares: number }

interface Props {
  article: NewsItem
  playerId: number
  cash: number
  positions: Position[]
  onClose: () => void
  /** Called when user picks a ticker to trade — parent opens TradePanel */
  onTrade: (ticker: string) => void
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtPrice(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function NewsModal({ article, positions, onClose, onTrade }: Props) {
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  // Fetch live prices for related tickers
  useEffect(() => {
    const tickers = article.relatedTickers.slice(0, 6)
    if (tickers.length === 0) return
    setLoadingQuotes(true)
    fetch(`/api/stocks?tickers=${tickers.join(',')}`)
      .then(r => r.json())
      .then(setQuotes)
      .catch(() => {})
      .finally(() => setLoadingQuotes(false))
  }, [article])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Article section ── */}
        {article.thumbnail && (
          <div className="relative h-52 overflow-hidden rounded-t-2xl bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
          </div>
        )}

        <div className="p-6">
          {/* Close + publisher row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="text-indigo-400 font-medium">{article.publisher}</span>
              {article.publishedAt && <span>· {timeAgo(article.publishedAt)}</span>}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Headline */}
          <h2 className="text-xl font-bold text-white leading-snug mb-4">{article.title}</h2>

          {/* Read article button */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-sm text-gray-300 hover:text-white transition-all"
          >
            <ExternalLink size={14} />
            Read Full Article
          </a>
        </div>

        {/* ── Trade section ── */}
        {(quotes.length > 0 || loadingQuotes || article.relatedTickers.length > 0) && (
          <>
            <div className="border-t border-gray-800 mx-6" />
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <ShoppingCart size={14} className="text-indigo-400" />
                Stocks in this story — trade now
              </h3>

              {loadingQuotes ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {article.relatedTickers.slice(0, 6).map(t => (
                    <div key={t} className="bg-gray-800 rounded-xl p-3 animate-pulse">
                      <div className="h-4 bg-gray-700 rounded mb-2 w-16" />
                      <div className="h-3 bg-gray-700 rounded mb-3 w-24" />
                      <div className="h-8 bg-gray-700 rounded" />
                    </div>
                  ))}
                </div>
              ) : quotes.length === 0 ? (
                <p className="text-sm text-gray-500">No tradable stocks found for this article.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {quotes.map(q => {
                    const isUp = q.changePct >= 0
                    const held = positions.find(p => p.ticker === q.ticker)
                    return (
                      <div
                        key={q.ticker}
                        className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-col gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-300">{q.ticker}</span>
                            <span className={`text-xs font-medium flex items-center gap-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                              {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {isUp ? '+' : ''}{q.changePct?.toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{q.name}</p>
                          <p className="text-base font-bold text-white mt-1">{fmtPrice(q.price)}</p>
                          {held && (
                            <p className="text-[10px] text-indigo-400 mt-0.5">Holding {held.shares} shares</p>
                          )}
                        </div>
                        <button
                          onClick={() => { onClose(); onTrade(q.ticker) }}
                          className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                        >
                          Trade
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
