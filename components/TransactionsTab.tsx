'use client'
import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'

interface Txn {
  id: number
  ticker: string
  type: 'buy' | 'sell'
  shares: number
  price: number
  total: number
  created_at: string
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function TransactionsTab({ playerId }: { playerId: number }) {
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/transactions?player=${playerId}`)
      .then(r => r.json())
      .then(d => { setTxns(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto mb-3" />
          Loading transactions…
        </div>
      </div>
    )
  }

  if (txns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No trades yet — your history will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Trade History</h2>
        <p className="text-xs text-gray-500 mt-0.5">{txns.length} transaction{txns.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-b border-gray-800">
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Ticker</th>
              <th className="px-5 py-3 text-right">Shares</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {txns.map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    t.type === 'buy'
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-red-900/40 text-red-400'
                  }`}>
                    {t.type === 'buy' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                    {t.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold text-indigo-300">{t.ticker}</td>
                <td className="px-5 py-3 text-right text-gray-300">{t.shares}</td>
                <td className="px-5 py-3 text-right text-gray-300">{fmt(t.price)}</td>
                <td className="px-5 py-3 text-right font-medium">{fmt(t.total)}</td>
                <td className="px-5 py-3 text-right text-gray-400 text-xs whitespace-nowrap">{fmtDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
