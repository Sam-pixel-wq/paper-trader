import { NextResponse } from 'next/server'
import { getDb, ensureInit, type Player, type Position, type Bracket } from '@/lib/db'
import { getPrices } from '@/lib/priceCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureInit()
    const db = getDb()

    const players = (await db.execute('SELECT * FROM players WHERE is_private = 0 ORDER BY created_at ASC')).rows as unknown as Player[]
    const allPositions = (await db.execute('SELECT * FROM positions')).rows as unknown as Position[]
    const brackets = (await db.execute('SELECT * FROM brackets ORDER BY starting_cash ASC')).rows as unknown as Bracket[]

    const uniqueTickers = [...new Set(allPositions.map(p => p.ticker))]
    const prices = await getPrices(uniqueTickers)

    const playerRows = players.map(player => {
      const positions = allPositions.filter(p => p.player_id === player.id)
      const stocksValue = positions.reduce((sum, p) => sum + (prices[p.ticker] ?? p.avg_cost) * p.shares, 0)
      const totalValue = player.cash + stocksValue
      const bracket = brackets.find(b => b.id === player.bracket_id)!
      const startingCash = player.starting_cash ?? bracket?.starting_cash ?? player.cash
      const pnl = totalValue - startingCash
      return {
        id: player.id, name: player.name, bracket_id: player.bracket_id,
        cash: player.cash, total_value: totalValue, pnl,
        return_pct: startingCash > 0 ? (pnl / startingCash) * 100 : 0,
        position_count: positions.length, created_at: player.created_at,
        starting_cash: startingCash,
      }
    })

    const leaderboard = brackets
      .filter(b => b.id !== 'custom')
      .map(bracket => ({
        ...bracket,
        players: playerRows
          .filter(p => p.bracket_id === bracket.id)
          .sort((a, b) => b.return_pct - a.return_pct)
          .map((p, i) => ({ ...p, rank: i + 1 })),
      }))

    const customPlayers = playerRows
      .filter(p => p.bracket_id === 'custom')
      .sort((a, b) => b.return_pct - a.return_pct)
      .map((p, i) => ({ ...p, rank: i + 1 }))

    if (customPlayers.length > 0) {
      leaderboard.push({
        id: 'custom', name: 'Custom', starting_cash: 0,
        emoji: '✏️', description: 'Pick your own starting amount',
        players: customPlayers,
      })
    }

    return NextResponse.json(leaderboard)
  } catch (err) {
    console.error('Leaderboard error:', err)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
