'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, BarChart2, Clock, Trophy, RefreshCw, ChevronDown, Newspaper, Swords } from 'lucide-react'
import dynamic from 'next/dynamic'
import TransactionsTab from '@/components/TransactionsTab'
import StocksTab from '@/components/StocksTab'
import LeaderboardTab from '@/components/LeaderboardTab'
import PlayerSetup from '@/components/PlayerSetup'
import NewsTab from '@/components/NewsTab'
import ChallengesTab from '@/components/ChallengesTab'

const PortfolioTab = dynamic(() => import('@/components/PortfolioTab'), { ssr: false })

type Tab = 'portfolio' | 'stocks' | 'news' | 'challenges' | 'leaderboard' | 'transactions'

interface ActivePlayer {
  id: number; name: string; bracket_id: string; is_private: boolean
}

interface Position {
  ticker: string; shares: number; avg_cost: number
  current_price: number; current_value: number; pnl: number; pnl_pct: number
}
interface Snapshot   { total_value: number; created_at: string }
interface Bracket    { id: string; name: string; starting_cash: number; emoji: string; description: string }
interface Portfolio  {
  player: ActivePlayer; bracket: Bracket; startingCash: number
  cash: number; totalValue: number; positions: Position[]; snapshots: Snapshot[]
}

const BRACKET_EMOJI: Record<string, string> = {
  '5k': '🌱', '10k': '💼', '50k': '📈', '100k': '🐋', 'custom': '✏️'
}

function fmt(n: number | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const LS_KEY = 'pt_player_v2'

export default function Home() {
  const [tab, setTab] = useState<Tab>('portfolio')
  const [player, setPlayer] = useState<ActivePlayer | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setPlayer(JSON.parse(raw))
    } catch { /* ignore */ }
    setReady(true)
  }, [])

  const loadPortfolio = useCallback(async (pid: number) => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/portfolio?player=${pid}`)
      if (!res.ok) return
      setPortfolio(await res.json())
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (player) loadPortfolio(player.id)
  }, [player, loadPortfolio])

  // Auto-refresh every 5 s — lives here so it uses the stable loadPortfolio
  // callback and never gets cancelled by a portfolio data re-render
  useEffect(() => {
    if (!player) return
    const id = setInterval(() => loadPortfolio(player.id), 5_000)
    return () => clearInterval(id)
  }, [player, loadPortfolio])

  function selectPlayer(p: ActivePlayer) {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
    setPlayer(p)
    setPortfolio(null)
    setShowSwitcher(false)
    setTab('portfolio')
  }

  function handleRefresh() {
    if (player) loadPortfolio(player.id)
  }

  const totalReturn = portfolio ? portfolio.totalValue - portfolio.startingCash : null
  const isUp = totalReturn != null ? totalReturn >= 0 : true
  const holdingTickers = portfolio?.positions.map(p => p.ticker) ?? []

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'portfolio',    label: 'Portfolio',    icon: <TrendingUp size={15} /> },
    { id: 'stocks',       label: 'Stocks',       icon: <BarChart2 size={15} /> },
    { id: 'news',         label: 'News',         icon: <Newspaper size={15} /> },
    { id: 'challenges',   label: 'Challenges',   icon: <Swords size={15} /> },
    { id: 'leaderboard',  label: 'Leaderboard',  icon: <Trophy size={15} /> },
    { id: 'transactions', label: 'Transactions', icon: <Clock size={15} /> },
  ]

  if (!ready) return null
  if (!player) return <PlayerSetup onSelect={selectPlayer} />

  const bracketEmoji = BRACKET_EMOJI[player.bracket_id] ?? '💼'
  const bracketLabel = portfolio?.bracket.name ?? player.bracket_id

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={20} className="text-indigo-400" />
              <span className="text-lg font-bold tracking-tight hidden sm:block">PaperTrader</span>
            </div>
            <button
              onClick={() => setShowSwitcher(true)}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-600 rounded-lg px-3 py-1.5 transition-all"
            >
              <span className="text-base leading-none">{bracketEmoji}</span>
              <span className="text-sm font-medium text-gray-200">{player.name}</span>
              {player.is_private && (
                <span className="text-[10px] text-gray-500 hidden sm:block">· Free Trade</span>
              )}
              <ChevronDown size={12} className="text-gray-400" />
            </button>
          </div>

          <div className="flex items-center gap-5">
            {portfolio && (
              <>
                <div className="hidden md:block text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Cash</div>
                  <div className="text-sm font-semibold text-gray-200">{fmt(portfolio.cash)}</div>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {bracketEmoji} {bracketLabel}
                  </div>
                  <div className="text-sm font-semibold text-gray-200">{fmt(portfolio.totalValue)}</div>
                </div>
                {totalReturn != null && (
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Return</div>
                    <div className={`text-sm font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{fmt(totalReturn)}
                    </div>
                  </div>
                )}
              </>
            )}
            <button
              onClick={handleRefresh} disabled={refreshing}
              className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex overflow-x-auto scrollbar-none">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-indigo-400 text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Disclaimer banner */}
      <div className="bg-indigo-950/40 border-b border-indigo-900/30">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 text-center text-xs text-indigo-300/80">
          {player.is_private
            ? '🔒 Free Trade Mode — real prices, virtual money, off the leaderboard'
            : `Paper trading · ${bracketEmoji} ${bracketLabel} bracket · virtual money · no real risk`}
        </p>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'portfolio' && (
          <PortfolioTab portfolio={portfolio} playerId={player.id} onRefresh={handleRefresh} />
        )}
        {tab === 'stocks' && (
          <StocksTab
            playerId={player.id}
            cash={portfolio?.cash ?? 0}
            positions={portfolio?.positions ?? []}
            onTrade={handleRefresh}
          />
        )}
        {tab === 'news' && (
          <NewsTab
            holdingTickers={holdingTickers}
            playerId={player.id}
            cash={portfolio?.cash ?? 0}
            positions={portfolio?.positions ?? []}
          />
        )}
        {tab === 'challenges' && (
          <ChallengesTab playerId={player.id} />
        )}
        {tab === 'leaderboard' && (
          <LeaderboardTab currentPlayerId={player.id} />
        )}
        {tab === 'transactions' && (
          <TransactionsTab playerId={player.id} />
        )}
      </main>

      {/* Player switcher overlay */}
      {showSwitcher && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSwitcher(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <PlayerSetup onSelect={selectPlayer} fullscreen={false} />
          </div>
        </div>
      )}
    </div>
  )
}
