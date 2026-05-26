'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, TrendingUp, TrendingDown, X } from 'lucide-react'
import TradePanel from './TradePanel'

interface StockRow {
  ticker: string; name: string; price: number
  change: number; changePct: number; volume: number
  marketCap?: number; sparkline?: number[]
}

interface SearchResult { ticker: string; name: string; exchange: string; type: string }

interface QuoteData {
  ticker: string; name: string; price: number; change: number; changePct: number
  open: number; high: number; low: number; volume: number
  marketCap: number; pe: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number
}

interface Position { ticker: string; shares: number }

interface Props {
  playerId: number; cash: number; positions: Position[]
  onTrade: () => void
}

const CATEGORIES = [
  { id: 'trending',   emoji: '🔥', label: 'Trending'   },
  { id: 'tech',       emoji: '💻', label: 'Technology' },
  { id: 'finance',    emoji: '🏦', label: 'Finance'    },
  { id: 'healthcare', emoji: '🏥', label: 'Healthcare' },
  { id: 'energy',     emoji: '⚡', label: 'Energy'     },
  { id: 'etfs',       emoji: '📦', label: 'ETFs'       },
]

function fmtPrice(n: number | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtCap(n: number | undefined) {
  if (!n) return null
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return null
}
function fmtVol(n: number | undefined) {
  if (!n) return null
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

// ── Lightweight SVG sparkline (no recharts overhead for 10 cards) ──
function Sparkline({ closes, isUp, ticker }: { closes: number[]; isUp: boolean; ticker: string }) {
  if (closes.length < 2) return <div className="h-10" />

  const min  = Math.min(...closes)
  const max  = Math.max(...closes)
  const range = max - min || 1
  const W = 100, H = 36

  // Build SVG path points
  const pts = closes.map((v, i) => {
    const x = (i / (closes.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return { x: +x.toFixed(2), y: +y.toFixed(2) }
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`
  const color    = isUp ? '#34d399' : '#f87171'
  const gradId   = `spk-${ticker}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Individual stock card ──────────────────────────────────────────
function StockCard({ stock, held, onSelect }: {
  stock: StockRow; held: boolean; onSelect: () => void
}) {
  const isUp = stock.changePct >= 0
  return (
    <button
      onClick={onSelect}
      className="group bg-gray-900 border border-gray-800 hover:border-indigo-700/60 rounded-xl text-left transition-all hover:shadow-lg hover:shadow-indigo-950/20 flex flex-col overflow-hidden"
    >
      {/* Card content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="font-bold text-indigo-300 text-base">{stock.ticker}</div>
            <div className="text-xs text-gray-400 truncate mt-0.5 max-w-[120px]">{stock.name}</div>
          </div>
          <div className={`flex items-center gap-0.5 text-xs font-semibold flex-shrink-0 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isUp ? '+' : ''}{stock.changePct?.toFixed(2)}%
          </div>
        </div>

        <div>
          <div className="text-xl font-bold text-white">{fmtPrice(stock.price)}</div>
          <div className={`text-xs mt-0.5 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '+' : ''}{fmtPrice(Math.abs(stock.change))} today
          </div>
        </div>

        <div className="flex gap-2 text-[10px] text-gray-500">
          {fmtCap(stock.marketCap) && <span>Cap {fmtCap(stock.marketCap)}</span>}
          {fmtVol(stock.volume)    && <span>Vol {fmtVol(stock.volume)}</span>}
        </div>

        <div className="flex items-center justify-between mt-1">
          {held && <span className="text-[10px] text-indigo-400 font-medium">● Holding</span>}
          <span className="ml-auto text-xs bg-indigo-600/20 group-hover:bg-indigo-600/40 text-indigo-300 px-2.5 py-1 rounded-lg font-medium transition-colors">
            Trade →
          </span>
        </div>
      </div>

      {/* 5-day sparkline — edge-to-edge at the bottom of the card */}
      <div className="w-full px-0">
        <Sparkline closes={stock.sparkline ?? []} isUp={isUp} ticker={stock.ticker} />
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function StocksTab({ playerId, cash, positions, onTrade }: Props) {
  const [category, setCategory]           = useState('trending')
  const [stocks, setStocks]               = useState<StockRow[]>([])
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [query, setQuery]                 = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching]         = useState(false)
  const [tradeQuote, setTradeQuote]       = useState<QuoteData | null>(null)
  const [loadingTicker, setLoadingTicker] = useState<string | null>(null)
  const [quoteError, setQuoteError]       = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdingSet  = new Set(positions.map(p => p.ticker))

  // Load category stocks (includes sparkline data from API)
  const loadCategory = useCallback(async (cat: string) => {
    setLoadingStocks(true)
    try {
      const res = await fetch(`/api/stocks?category=${cat}`)
      setStocks(await res.json())
    } finally {
      setLoadingStocks(false)
    }
  }, [])

  useEffect(() => { loadCategory(category) }, [category, loadCategory])

  // Debounced search
  function handleQuery(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        setSearchResults(await res.json())
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function openTrade(ticker: string) {
    setLoadingTicker(ticker)
    setQuoteError('')
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(ticker)}`)
      const q = await res.json()
      if (!res.ok || q.price == null) { setQuoteError(q.error || 'Could not load quote'); return }
      setTradeQuote(q)
    } finally {
      setLoadingTicker(null)
    }
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="space-y-5">
      {/* ── Search bar ─────────────────────────── */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search any stock or ETF — e.g. Apple, TSLA, S&P 500…"
          value={query}
          onChange={e => handleQuery(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-10 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" />
          </div>
        )}
        {query && !searching && (
          <button
            onClick={() => { setQuery(''); setSearchResults([]) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {quoteError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {quoteError}
        </div>
      )}

      {/* ── Search results ─────────────────────── */}
      {isSearching && (
        searchResults.length > 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={r.ticker}
                onClick={() => openTrade(r.ticker)}
                disabled={loadingTicker === r.ticker}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800 transition-colors text-left ${i < searchResults.length - 1 ? 'border-b border-gray-800' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-indigo-300">{r.ticker}</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{r.type}</span>
                    {holdingSet.has(r.ticker) && (
                      <span className="text-[10px] text-indigo-400">● Holding</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">{r.name}</p>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <span>{r.exchange}</span>
                  {loadingTicker === r.ticker
                    ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" />
                    : <TrendingUp size={14} />}
                </div>
              </button>
            ))}
          </div>
        ) : !searching ? (
          <div className="text-center py-12 text-gray-500">
            <Search size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No results for &quot;{query}&quot;</p>
          </div>
        ) : null
      )}

      {/* ── Browse by category ─────────────────── */}
      {!isSearching && (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  category === c.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <span>{c.emoji}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            ))}
          </div>

          {/* Stock grid */}
          {loadingStocks ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden animate-pulse">
                  <div className="p-4">
                    <div className="h-5 bg-gray-800 rounded w-16 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-24 mb-4" />
                    <div className="h-7 bg-gray-800 rounded w-20 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-16" />
                  </div>
                  <div className="h-10 bg-gray-800/60" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {stocks.map(s => (
                <StockCard
                  key={s.ticker}
                  stock={s}
                  held={holdingSet.has(s.ticker)}
                  onSelect={() => openTrade(s.ticker)}
                />
              ))}
              {stocks.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 text-sm">
                  Could not load stocks. Try refreshing.
                </div>
              )}
            </div>
          )}

          {loadingTicker && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4 flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400" />
                <span className="text-sm text-gray-300">Loading {loadingTicker}…</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Trade panel */}
      {tradeQuote && (
        <TradePanel
          quote={tradeQuote}
          playerId={playerId}
          cash={cash}
          existingShares={positions.find(p => p.ticker === tradeQuote.ticker)?.shares ?? 0}
          onClose={() => setTradeQuote(null)}
          onTradeComplete={() => { setTradeQuote(null); onTrade() }}
        />
      )}
    </div>
  )
}
