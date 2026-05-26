'use client'
import { useEffect, useState } from 'react'
import { Trophy, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

interface PlayerRow {
  id: number
  name: string
  total_value: number
  cash: number
  pnl: number
  return_pct: number
  position_count: number
  created_at: string
  rank: number
}

interface BracketBoard {
  id: string
  name: string
  starting_cash: number
  emoji: string
  description: string
  players: PlayerRow[]
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="text-lg">{MEDAL[rank]}</span>
  return <span className="text-sm font-bold text-gray-500 w-6 text-center">#{rank}</span>
}

export default function LeaderboardTab({ currentPlayerId }: { currentPlayerId: number }) {
  const [data, setData] = useState<BracketBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [activeBracket, setActiveBracket] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard')
      const boards: BracketBoard[] = await res.json()
      setData(boards)
      setLastUpdated(new Date())
      // Default to the bracket that has the most players (or first non-empty)
      if (!activeBracket) {
        const first = boards.find(b => b.players.length > 0) ?? boards[0]
        if (first) setActiveBracket(first.id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const active = data.find(b => b.id === activeBracket) ?? data[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-yellow-400" />
          <h2 className="text-lg font-bold">Leaderboard</h2>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              · updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Bracket tabs */}
      <div className="flex gap-2 flex-wrap">
        {data.map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBracket(b.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeBracket === b.id
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <span>{b.emoji}</span>
            <span>{b.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeBracket === b.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-gray-800 text-gray-500'
            }`}>
              {b.players.length}
            </span>
          </button>
        ))}
      </div>

      {loading && !active ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
        </div>
      ) : active ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Bracket header */}
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{active.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white">{active.name} Bracket</h3>
                    <p className="text-xs text-gray-400">
                      Starting balance: {fmt(active.starting_cash)} · {active.description}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-400">{active.players.length}</div>
                <div className="text-xs text-gray-500">player{active.players.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>

          {active.players.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Trophy size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No players in this bracket yet.</p>
              <p className="text-xs text-gray-600 mt-1">Create a player to claim the #1 spot!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800 uppercase tracking-wider">
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">Player</th>
                    <th className="px-6 py-3 text-right">Portfolio Value</th>
                    <th className="px-6 py-3 text-right">P&amp;L</th>
                    <th className="px-6 py-3 text-right">Return</th>
                    <th className="px-6 py-3 text-right">Positions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.players.map(p => {
                    const isYou = p.id === currentPlayerId
                    const isUp = p.return_pct >= 0
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-gray-800/50 transition-colors ${
                          isYou
                            ? 'bg-indigo-950/40 border-indigo-900/30'
                            : 'hover:bg-gray-800/30'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <RankBadge rank={p.rank} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{p.name}</span>
                            {isYou && (
                              <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded-full font-medium">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">{fmt(p.total_value)}</td>
                        <td className={`px-6 py-4 text-right font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {isUp ? '+' : ''}{fmt(p.pnl)}
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          {isUp ? '+' : ''}{p.return_pct.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400">{p.position_count}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
