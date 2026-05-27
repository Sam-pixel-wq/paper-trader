'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { X, Newspaper } from 'lucide-react'
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

interface Toast {
  id:      string
  article: NewsItem
  key:     number   // unique render key so each toast gets its own animation
}

interface Props {
  playerId:       number
  cash:           number
  positions:      Position[]
  holdingTickers: string[]
  onPortfolioRefresh?: () => void
}

const TOAST_MS   = 9_000    // how long each toast lingers
const FIRST_MS   = 15_000   // delay before showing first toast
const REPEAT_MS  = 55_000   // interval between subsequent toasts
const MAX_TOASTS = 3

export default function NewsToast({ playerId, cash, positions, holdingTickers, onPortfolioRefresh }: Props) {
  const [news,            setNews]            = useState<NewsItem[]>([])
  const [toasts,          setToasts]          = useState<Toast[]>([])
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null)
  const [tradeQuote,      setTradeQuote]      = useState<QuoteData | null>(null)
  const [loadingTrade,    setLoadingTrade]    = useState(false)

  const shownIds    = useRef(new Set<string>())
  const dismissMap  = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const newsRef     = useRef<NewsItem[]>([])
  const toastKey    = useRef(0)
  newsRef.current   = news

  // ── Fetch news ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadNews() {
      try {
        const res  = await fetch('/api/news')
        const data = await res.json()
        setNews(data)
      } catch { /* ignore */ }
    }
    loadNews()
    const id = setInterval(loadNews, 90_000)
    return () => clearInterval(id)
  }, [])

  // ── Dismiss a toast ───────────────────────────────────────────────────────
  const dismiss = useCallback((id: string) => {
    const t = dismissMap.current.get(id)
    if (t) clearTimeout(t)
    dismissMap.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Show next unseen article as a toast ───────────────────────────────────
  const showToast = useCallback(() => {
    const pool = newsRef.current.filter(n => !shownIds.current.has(n.id))
    if (pool.length === 0) return

    const article = pool[Math.floor(Math.random() * Math.min(6, pool.length))]
    shownIds.current.add(article.id)

    const id  = article.id
    const key = ++toastKey.current

    setToasts(prev => {
      const next = [...prev, { id, article, key }]
      if (next.length > MAX_TOASTS) {
        // auto-dismiss oldest overflow toast
        const oldest = next[0]
        dismiss(oldest.id)
        return next.slice(1)
      }
      return next
    })

    const timer = setTimeout(() => dismiss(id), TOAST_MS)
    dismissMap.current.set(id, timer)
  }, [dismiss])

  // ── Schedule first popup + repeating interval ─────────────────────────────
  const scheduledRef = useRef(false)
  useEffect(() => {
    if (news.length === 0 || scheduledRef.current) return
    scheduledRef.current = true

    const first    = setTimeout(showToast, FIRST_MS)
    const interval = setInterval(showToast, REPEAT_MS)

    return () => { clearTimeout(first); clearInterval(interval) }
  }, [news, showToast])

  // ── Trade from news modal ─────────────────────────────────────────────────
  async function handleTradeFromNews(ticker: string) {
    setSelectedArticle(null)
    setLoadingTrade(true)
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(ticker)}`)
      const q   = await res.json()
      if (res.ok && q.price != null) setTradeQuote(q)
    } finally {
      setLoadingTrade(false)
    }
  }

  return (
    <>
      {/* ── Toast stack (bottom-right) ────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col-reverse gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <ToastCard
            key={t.key}
            toast={t}
            durationMs={TOAST_MS}
            onDismiss={() => dismiss(t.id)}
            onClick={() => {
              dismiss(t.id)
              setSelectedArticle(t.article)
            }}
          />
        ))}
      </div>

      {/* Loading overlay when opening trade from toast */}
      {loadingTrade && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400" />
            <span className="text-sm text-gray-300">Loading quote…</span>
          </div>
        </div>
      )}

      {/* Article modal opened from toast */}
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

      {/* Trade panel opened from news modal */}
      {tradeQuote && (
        <TradePanel
          quote={tradeQuote}
          playerId={playerId}
          cash={cash}
          existingShares={positions.find(p => p.ticker === tradeQuote.ticker)?.shares ?? 0}
          onClose={() => setTradeQuote(null)}
          onTradeComplete={() => {
            setTradeQuote(null)
            onPortfolioRefresh?.()
          }}
        />
      )}
    </>
  )
}

// ── Single toast card ─────────────────────────────────────────────────────────
function ToastCard({
  toast, durationMs, onDismiss, onClick,
}: {
  toast: Toast; durationMs: number; onDismiss: () => void; onClick: () => void
}) {
  const { article } = toast

  return (
    <div
      className="pointer-events-auto w-72 sm:w-80 bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl shadow-black/40 overflow-hidden cursor-pointer hover:border-indigo-500/60 transition-colors animate-news-in"
      onClick={onClick}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail */}
        {article.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.thumbnail}
            alt=""
            className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-800"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-14 h-14 bg-indigo-950/60 rounded-lg flex items-center justify-center flex-shrink-0">
            <Newspaper size={18} className="text-indigo-600" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="text-[10px] text-indigo-400 font-semibold leading-none">
              {article.publisher}
            </span>
            <button
              className="text-gray-600 hover:text-gray-300 flex-shrink-0 transition-colors p-0.5"
              onClick={e => { e.stopPropagation(); onDismiss() }}
            >
              <X size={11} />
            </button>
          </div>

          <p className="text-[11px] text-gray-100 font-medium leading-snug line-clamp-3">
            {article.title}
          </p>

          {article.relatedTickers.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {article.relatedTickers.slice(0, 4).map(t => (
                <span key={t} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Countdown progress bar */}
      <div className="h-0.5 bg-gray-800 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-indigo-500 origin-left animate-news-bar"
          style={{ '--tw-duration': `${durationMs}ms`, animationDuration: `${durationMs}ms` } as React.CSSProperties}
        />
      </div>
    </div>
  )
}
