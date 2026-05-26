'use client'
import { useEffect, useState, useCallback } from 'react'
import { Trophy, ChevronDown, ChevronUp, RefreshCw, CheckCircle, Clock } from 'lucide-react'

interface ChallengeEntry {
  player_id: number; name: string; return_pct: number; current_value: number
  starting_value: number; joined_at: string; is_you: boolean; rank: number
}

interface ChallengeData {
  id: number; name: string; description: string; icon: string
  target_pct: number | null; duration_days: number; is_active: number
  created_at: string; total_entries: number
  my_entry: ChallengeEntry | null
  leaderboard: ChallengeEntry[]
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ChallengesTab({ playerId }: { playerId: number }) {
  const [challenges, setChallenges] = useState<ChallengeData[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [joining, setJoining] = useState<number | null>(null)
  const [leaving, setLeaving] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/challenges?player=${playerId}`)
      setChallenges(await res.json())
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => { load() }, [load])

  async function join(challengeId: number) {
    setJoining(challengeId)
    try {
      await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, challenge_id: challengeId }),
      })
      await load()
      setExpanded(challengeId)
    } finally {
      setJoining(null)
    }
  }

  async function leave(challengeId: number) {
    setLeaving(challengeId)
    try {
      await fetch('/api/challenges', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, challenge_id: challengeId }),
      })
      await load()
    } finally {
      setLeaving(null)
    }
  }

  const myChallenges = challenges.filter(c => c.my_entry)
  const available = challenges.filter(c => !c.my_entry)

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-yellow-400" />
          <h2 className="text-lg font-bold">Challenges</h2>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* My active challenges */}
      {myChallenges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">My Challenges</h3>
          {myChallenges.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              expanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              onLeave={() => leave(c.id)}
              leaving={leaving === c.id}
              joined
            />
          ))}
        </div>
      )}

      {/* Available challenges */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {myChallenges.length > 0 ? 'Other Challenges' : 'Active Challenges'}
        </h3>
        {available.length === 0 ? (
          <p className="text-gray-500 text-sm">You&apos;ve joined all active challenges!</p>
        ) : (
          available.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              expanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              onJoin={() => join(c.id)}
              joining={joining === c.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ChallengeCard({
  challenge: c, expanded, onToggle, onJoin, onLeave, joining, leaving, joined,
}: {
  challenge: ChallengeData; expanded: boolean; onToggle: () => void
  onJoin?: () => void; onLeave?: () => void
  joining?: boolean; leaving?: boolean; joined?: boolean
}) {
  const me = c.my_entry
  const isUp = (me?.return_pct ?? 0) >= 0
  const daysSinceJoined = me ? daysAgo(me.joined_at) : 0
  const completed = me && c.target_pct != null && me.return_pct >= c.target_pct

  return (
    <div className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
      joined ? 'border-indigo-800/60' : 'border-gray-800'
    }`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-3xl flex-shrink-0 mt-0.5">{c.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white">{c.name}</h3>
                {completed && (
                  <span className="flex items-center gap-1 text-[10px] bg-green-900/40 text-green-400 border border-green-800/50 px-1.5 py-0.5 rounded-full font-medium">
                    <CheckCircle size={10} /> Completed!
                  </span>
                )}
                {joined && !completed && (
                  <span className="text-[10px] bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded-full font-medium">
                    Joined
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{c.description}</p>
              {/* Meta row */}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                {c.target_pct != null && (
                  <span className="flex items-center gap-1">
                    🎯 Target: <span className="text-indigo-300 font-medium">+{c.target_pct}%</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {c.duration_days}-day window
                </span>
                <span>{c.total_entries} player{c.total_entries !== 1 ? 's' : ''} competing</span>
              </div>
            </div>
          </div>

          {/* My stats (if joined) */}
          {me && (
            <div className="text-right flex-shrink-0">
              <div className={`text-xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{me.return_pct.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                Rank #{me.rank} · day {daysSinceJoined}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide' : 'View'} Leaderboard ({c.total_entries})
          </button>

          {!joined && onJoin && (
            <button
              onClick={onJoin}
              disabled={joining}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {joining ? 'Joining…' : '+ Join Challenge'}
            </button>
          )}
          {joined && onLeave && (
            <button
              onClick={onLeave}
              disabled={leaving}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {leaving ? 'Leaving…' : 'Leave'}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      {expanded && (
        <div className="border-t border-gray-800">
          {c.leaderboard.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">No entries yet — be the first to join!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800/50 uppercase tracking-wider">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3 text-right">Return</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-right">Days In</th>
                </tr>
              </thead>
              <tbody>
                {c.leaderboard.map(e => {
                  const up = e.return_pct >= 0
                  const won = c.target_pct != null && e.return_pct >= c.target_pct
                  return (
                    <tr
                      key={e.player_id}
                      className={`border-b border-gray-800/30 ${e.is_you ? 'bg-indigo-950/30' : 'hover:bg-gray-800/20'} transition-colors`}
                    >
                      <td className="px-5 py-3">
                        {e.rank <= 3
                          ? <span className="text-lg">{MEDAL[e.rank]}</span>
                          : <span className="text-xs font-bold text-gray-500 w-6 inline-block text-center">#{e.rank}</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.name}</span>
                          {e.is_you && <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-700/50 px-1 py-0.5 rounded-full">YOU</span>}
                          {won && <span className="text-[10px] text-green-400">✓ Done</span>}
                        </div>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold ${up ? 'text-green-400' : 'text-red-400'}`}>
                        {up ? '+' : ''}{e.return_pct.toFixed(2)}%
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300 text-xs">{fmt(e.current_value)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs">{daysAgo(e.joined_at)}d</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
