'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import TradePanel from './TradePanel'

const PortfolioChart = dynamic(() => import('./PortfolioChart'), { ssr: false })

interface Position {
  ticker: string; shares: number; avg_cost: number
  current_price: number; current_value: number; pnl: number; pnl_pct: number
}
interface Snapshot { total_value: number; created_at: string }
interface Portfolio {
  cash: number; totalValue: number; startingCash: number
  positions: Position[]; snapshots: Snapshot[]
}
interface QuoteData {
  ticker: string; name: string; price: number; change: number; changePct: number
  open: number; high: number; low: number; volume: number
  marketCap: number; pe: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number
}
interface Props { portfolio: Portfolio | null; playerId: number; onRefresh: () => void }

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isMarketOpen(): boolean {
  try {
    const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = et.getDay()
    if (day === 0 || day === 6) return false
    const mins = et.getHours() * 60 + et.getMinutes()
    return mins >= 570 && mins < 960
  } catch { return false }
}

function MarketBadge() {
  const open = isMarketOpen()
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
      open ? 'bg-green-950/60 text-green-400' : 'bg-gray-800 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
      {open ? 'Market Open' : 'Market Closed'}
    </span>
  )
}

export default function PortfolioTab({ portfolio, playerId, onRefresh }: Props) {
  const [selectedQuote, setSelectedQuote] = useState<QuoteData | null>(null)
  const [loadingTicker, setLoadingTicker] = useState<string | null>(null)
  const [quoteError,    setQuoteError]    = useState('')
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null)

  // Timestamp updates whenever the portfolio prop changes (driven by page.tsx's 5s timer)
  useEffect(() => { setLastUpdated(new Date()) }, [portfolio])

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto mb-3" />
          Loading portfolio…
        </div>
      </div>
    )
  }

  const startingCash   = portfolio.startingCash
  const totalReturn    = portfolio.totalValue - startingCash
  const totalReturnPct = startingCash > 0 ? (totalReturn / startingCash) * 100 : 0
  const isUp           = totalReturn >= 0

  async function openTrade(ticker: string) {
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
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign size={12} /> Cash Balance
          </div>
          <div className="text-2xl font-bold">{fmt(portfolio.cash)}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              {isUp
                ? <TrendingUp size={12} className="text-green-400" />
                : <TrendingDown size={12} className="text-red-400" />}
              Portfolio Value
            </div>
            <MarketBadge />
          </div>
          <div className="text-2xl font-bold">{fmt(portfolio.totalValue)}</div>
          {lastUpdated && (
            <div className="flex items-center gap-1 mt-1">
              <RefreshCw size={8} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">
                {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <div className={`border rounded-xl p-4 ${isUp ? 'bg-green-950/30 border-green-900/40' : 'bg-red-950/30 border-red-900/40'}`}>
          <div className="text-gray-400 text-xs mb-1">Total Return</div>
          <div className={`text-2xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{fmt(totalReturn)}
          </div>
          <div className={`text-sm ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '+' : ''}{totalReturnPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ── Portfolio chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Portfolio Value Over Time</h2>
        <PortfolioChart snapshots={portfolio.snapshots} />
      </div>

      {quoteError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {quoteError}
        </div>
      )}

      {/* ── Positions table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Holdings</h2>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        {portfolio.positions.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No positions yet — go to Stocks to make your first trade.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-800">
                  <th className="px-5 py-3">Ticker</th>
                  <th className="px-5 py-3 text-right">Shares</th>
                  <th className="px-5 py-3 text-right">Avg Cost</th>
                  <th className="px-5 py-3 text-right">Current</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-right">P&amp;L</th>
                  <th className="px-5 py-3 text-right">Return</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map(p => (
                  <tr key={p.ticker} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-indigo-300">{p.ticker}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{p.shares}</td>
                    <td className="px-5 py-3 text-right text-gray-400">{fmt(p.avg_cost)}</td>
                    <td className="px-5 py-3 text-right">{fmt(p.current_price)}</td>
                    <td className="px-5 py-3 text-right font-medium">{fmt(p.current_value)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${p.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)}
                    </td>
                    <td className={`px-5 py-3 text-right text-xs font-medium ${p.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openTrade(p.ticker)}
                        disabled={loadingTicker === p.ticker}
                        className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loadingTicker === p.ticker ? '…' : 'Trade'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedQuote && (
        <TradePanel
          quote={selectedQuote}
          cash={portfolio.cash}
          playerId={playerId}
          existingShares={portfolio.positions.find(p => p.ticker === selectedQuote.ticker)?.shares ?? 0}
          onClose={() => setSelectedQuote(null)}
          onTradeComplete={() => { setSelectedQuote(null); onRefresh() }}
        />
      )}
    </div>
  )
}
