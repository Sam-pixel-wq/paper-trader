'use client'
import { useState } from 'react'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import StockChart from './StockChart'

interface Quote {
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

interface Props {
  quote: Quote
  cash: number
  playerId: number
  existingShares?: number
  onClose: () => void
  onTradeComplete: () => void
}

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TradePanel({ quote, cash, playerId, existingShares = 0, onClose, onTradeComplete }: Props) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [sharesInput, setSharesInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const shares = parseFloat(sharesInput) || 0
  const total = shares * quote.price
  const maxBuy = Math.floor((cash / quote.price) * 100) / 100
  const isPositive = quote.change >= 0

  async function handleTrade() {
    if (!shares || shares <= 0) { setError('Enter a valid number of shares'); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, ticker: quote.ticker, type: side, shares }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Trade failed'); return }
      setSuccess(`${side === 'buy' ? 'Bought' : 'Sold'} ${shares} share${shares !== 1 ? 's' : ''} of ${quote.ticker} @ ${fmt(data.price)}`)
      setSharesInput('')
      onTradeComplete()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{quote.ticker}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${isPositive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                {isPositive ? '+' : ''}{quote.changePct?.toFixed(2)}%
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-0.5 truncate max-w-xs">{quote.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold">${quote.price?.toFixed(2)}</div>
              <div className={`text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isPositive ? '+' : ''}{quote.change?.toFixed(2)}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Chart */}
          <StockChart ticker={quote.ticker} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 my-4 text-xs">
            {[
              ['Open', `$${quote.open?.toFixed(2)}`],
              ['High', `$${quote.high?.toFixed(2)}`],
              ['Low', `$${quote.low?.toFixed(2)}`],
              ['Mkt Cap', fmt(quote.marketCap)],
              ['P/E', quote.pe?.toFixed(1) ?? '—'],
              ['52W Range', `${quote.fiftyTwoWeekLow?.toFixed(0)}–${quote.fiftyTwoWeekHigh?.toFixed(0)}`],
            ].map(([label, val]) => (
              <div key={label} className="bg-gray-800 rounded-lg p-2">
                <div className="text-gray-400 mb-0.5">{label}</div>
                <div className="text-white font-medium">{val}</div>
              </div>
            ))}
          </div>

          {/* Trade form */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex rounded-lg overflow-hidden mb-4 border border-gray-700">
              <button
                onClick={() => { setSide('buy'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${side === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Buy
              </button>
              <button
                onClick={() => { setSide('sell'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${side === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Sell
              </button>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Shares</span>
                <span>
                  {side === 'buy'
                    ? `Max: ${maxBuy} (${fmt(cash)} available)`
                    : `Have: ${existingShares} shares`}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={sharesInput}
                  onChange={e => { setSharesInput(e.target.value); setError(''); setSuccess('') }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setSharesInput(side === 'buy' ? String(maxBuy) : String(existingShares))}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg border border-gray-600 transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            {shares > 0 && (
              <div className="flex justify-between text-sm text-gray-300 mb-3">
                <span>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</span>
                <span className="font-semibold text-white">{fmt(total)}</span>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            {success && <p className="text-green-400 text-xs mb-3">{success}</p>}

            <button
              onClick={handleTrade}
              disabled={loading || !shares}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                side === 'buy'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {loading ? 'Processing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${quote.ticker}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
