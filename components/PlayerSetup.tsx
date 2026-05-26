'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, UserPlus, Users, Check, EyeOff } from 'lucide-react'

const PRESET_BRACKETS = [
  { id: '5k',   emoji: '🌱', name: 'Penny Pincher', cash: '$5,000',   desc: 'Start lean, think smart' },
  { id: '10k',  emoji: '💼', name: 'Day Trader',    cash: '$10,000',  desc: 'Classic retail investor' },
  { id: '50k',  emoji: '📈', name: 'Swing Trader',  cash: '$50,000',  desc: 'Bigger moves, bigger risks' },
  { id: '100k', emoji: '🐋', name: 'Whale',         cash: '$100,000', desc: 'Go big or go home' },
  { id: 'custom', emoji: '✏️', name: 'Custom',       cash: 'Any amount', desc: 'Pick your own balance' },
]

interface ExistingPlayer {
  id: number; name: string; bracket_id: string; bracket_name: string
  emoji: string; cash: number; starting_cash: number; is_private: number
}

interface Props {
  onSelect: (player: { id: number; name: string; bracket_id: string; is_private: boolean }) => void
  fullscreen?: boolean
}

export default function PlayerSetup({ onSelect, fullscreen = true }: Props) {
  const [mode, setMode] = useState<'new' | 'returning'>('new')
  const [name, setName] = useState('')
  const [bracketId, setBracketId] = useState('10k')
  const [customAmount, setCustomAmount] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState<ExistingPlayer[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)

  useEffect(() => {
    fetch('/api/players')
      .then(r => r.json())
      .then((d: ExistingPlayer[]) => {
        setExisting(d)
        if (d.length > 0) setMode('returning')
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Enter your name'); return }
    if (bracketId === 'custom') {
      const amt = parseFloat(customAmount.replace(/,/g, ''))
      if (isNaN(amt) || amt < 100) { setError('Enter a valid amount (min $100)'); return }
      if (amt > 10_000_000) { setError('Max $10,000,000'); return }
    }
    setSubmitting(true)
    setError('')
    try {
      const amt = bracketId === 'custom'
        ? parseFloat(customAmount.replace(/,/g, ''))
        : undefined
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), bracket_id: bracketId, custom_amount: amt, is_private: isPrivate }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not create player'); return }
      onSelect({ id: data.id, name: data.name, bracket_id: data.bracket_id, is_private: !!data.is_private })
    } finally {
      setSubmitting(false)
    }
  }

  const inner = (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <TrendingUp size={28} className="text-indigo-400" />
        <span className="text-3xl font-bold tracking-tight">PaperTrader</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Mode tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setMode('new')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
              mode === 'new'
                ? 'bg-indigo-600/10 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <UserPlus size={15} /> New Player
          </button>
          <button
            onClick={() => setMode('returning')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
              mode === 'returning'
                ? 'bg-indigo-600/10 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={15} /> Returning Player
          </button>
        </div>

        <div className="p-6">
          {/* ── NEW PLAYER ── */}
          {mode === 'new' && (
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Your Name</label>
                <input
                  type="text" placeholder="e.g. Sam" value={name}
                  onChange={e => { setName(e.target.value); setError('') }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  autoFocus maxLength={24}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Choose Your Bracket</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_BRACKETS.map(b => (
                    <button
                      key={b.id} type="button" onClick={() => setBracketId(b.id)}
                      className={`relative text-left rounded-xl p-3.5 border transition-all ${
                        bracketId === b.id
                          ? 'border-indigo-500 bg-indigo-600/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      {bracketId === b.id && (
                        <div className="absolute top-2 right-2"><Check size={13} className="text-indigo-400" /></div>
                      )}
                      <div className="text-xl mb-1">{b.emoji}</div>
                      <div className="text-sm font-semibold text-white">{b.name}</div>
                      <div className="text-xs text-indigo-300 font-medium">{b.cash}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{b.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                {bracketId === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Starting Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                      <input
                        type="number" min="100" max="10000000" step="100"
                        placeholder="e.g. 25000"
                        value={customAmount}
                        onChange={e => { setCustomAmount(e.target.value); setError('') }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Min $100 · Max $10,000,000</p>
                  </div>
                )}
              </div>

              {/* Free Trade toggle */}
              <button
                type="button"
                onClick={() => setIsPrivate(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  isPrivate
                    ? 'border-gray-600 bg-gray-800'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <EyeOff size={16} className={isPrivate ? 'text-indigo-400' : 'text-gray-500'} />
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Free Trade Mode</div>
                    <div className="text-xs text-gray-400">Just trade — don&apos;t appear on any leaderboard</div>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${isPrivate ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Start Trading →'}
              </button>
            </form>
          )}

          {/* ── RETURNING PLAYER ── */}
          {mode === 'returning' && (
            <div>
              {loadingExisting ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
                </div>
              ) : existing.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm mb-3">No players yet.</p>
                  <button onClick={() => setMode('new')} className="text-indigo-400 text-sm underline">
                    Create your first player
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {existing.map(p => {
                    const b = PRESET_BRACKETS.find(x => x.id === p.bracket_id)
                    const startCash = p.starting_cash ?? 0
                    // cash-only return estimate (doesn't include positions value)
                    const pct = startCash > 0 ? ((p.cash - startCash) / startCash * 100) : 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect({ id: p.id, name: p.name, bracket_id: p.bracket_id, is_private: !!p.is_private })}
                        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-700 rounded-xl px-4 py-3.5 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{b?.emoji ?? p.emoji ?? '💼'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{p.name}</span>
                              {!!p.is_private && (
                                <span className="flex items-center gap-1 text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                                  <EyeOff size={9} /> Free Trade
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {p.bracket_id === 'custom'
                                ? `Custom · $${(p.starting_cash ?? 0).toLocaleString()}`
                                : `${b?.name ?? p.bracket_name} · ${b?.cash}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">est. return</div>
                        </div>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setMode('new')}
                    className="w-full py-2.5 text-sm text-gray-400 hover:text-white transition-colors border border-dashed border-gray-700 hover:border-gray-500 rounded-xl mt-1"
                  >
                    + Create a new player
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        Real prices · Virtual money · No real risk
      </p>
    </div>
  )

  if (!fullscreen) return inner
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="py-8 flex items-center justify-center w-full min-h-full">
        {inner}
      </div>
    </div>
  )
}
