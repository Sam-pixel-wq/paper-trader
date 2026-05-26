'use client'
import { useState, useCallback, useRef } from 'react'
import { Search, TrendingUp, TrendingDown } from 'lucide-react'
import TradePanel from './TradePanel'

interface SearchResult { ticker: string; name: string; exchange: string; type: string }

interface QuoteData {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  volume: number
  marketCap: number
  pe: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

interface Portfolio {
  cash: number
  positions: Array<{ ticker: string; shares: number }>
}

interface Props {
  onTrade: () => void
  portfolio: Portfolio | null
  playerId: number
}

export default function SearchTab({ onTrade, portfolio, playerId }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<QuoteData | null>(null)
  const [loadingTicker, setLoadingTicker] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        setResults(await res.json())
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  async function selectStock(ticker: string) {
    setLoadingTicker(ticker)
    setQuoteError('')
    setSelectedQuote(null)
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(ticker)}`)
      const q = await res.json()
      if (!res.ok || !q.ticker || q.price == null) {
        setQuoteError(q.error || 'Could not load stock data')
        return
      }
      setSelectedQuote(q)
    } catch {
      setQuoteError('Network error — try again in a moment')
    } finally {
      setLoadingTicker(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Search input */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search stocks — try 'Apple', 'TSLA', 'S&P 500'…"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          autoFocus
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" />
          </div>
        )}
      </div>

      {quoteError && (
        <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {quoteError}
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <button
              key={r.ticker}
              onClick={() => selectStock(r.ticker)}
              disabled={loadingTicker === r.ticker}
              className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800 transition-colors text-left ${
                i < results.length - 1 ? 'border-b border-gray-800' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-300">{r.ticker}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{r.type}</span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{r.name}</p>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <span>{r.exchange}</span>
                {loadingTicker === r.ticker ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" />
                ) : (
                  <TrendingUp size={14} />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : query && !searching ? (
        <div className="text-center py-16 text-gray-500">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results for &quot;{query}&quot;</p>
        </div>
      ) : !query ? (
        <div className="text-center py-16 text-gray-600">
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-8">
            {['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'GOOGL'].map(ticker => (
              <button
                key={ticker}
                onClick={() => selectStock(ticker)}
                disabled={loadingTicker === ticker}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 hover:border-indigo-700 hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-semibold text-indigo-300">{ticker}</span>
                {loadingTicker === ticker
                  ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400" />
                  : <TrendingUp size={12} className="text-gray-500" />}
              </button>
            ))}
          </div>
          <p className="text-sm">Search for any stock or ETF, or pick a popular one above</p>
        </div>
      ) : null}

      {selectedQuote && (
        <TradePanel
          quote={selectedQuote}
          cash={portfolio?.cash ?? 0}
          playerId={playerId}
          existingShares={portfolio?.positions.find(p => p.ticker === selectedQuote.ticker)?.shares ?? 0}
          onClose={() => setSelectedQuote(null)}
          onTradeComplete={() => {
            setSelectedQuote(null)
            onTrade()
          }}
        />
      )}
    </div>
  )
}
