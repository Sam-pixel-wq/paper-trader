import { NextResponse, type NextRequest } from 'next/server'
import { getDb, type Position, type Snapshot, type Player, type Bracket } from '@/lib/db'
import { getPrices } from '@/lib/priceCache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const playerId = parseInt(req.nextUrl.searchParams.get('player') ?? '0')
  if (!playerId) return NextResponse.json({ error: 'Missing player' }, { status: 400 })

  try {
    const db = getDb()
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as Player | undefined
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    const bracket = db.prepare('SELECT * FROM brackets WHERE id = ?').get(player.bracket_id) as Bracket
    const positions = db.prepare('SELECT * FROM positions WHERE player_id = ?').all(playerId) as Position[]
    const prices = await getPrices(positions.map(p => p.ticker))

    const positionsWithPrices = positions.map(p => {
      const price = prices[p.ticker] ?? p.avg_cost
      return {
        ticker: p.ticker, shares: p.shares, avg_cost: p.avg_cost,
        current_price: price,
        current_value: price * p.shares,
        pnl: (price - p.avg_cost) * p.shares,
        pnl_pct: ((price - p.avg_cost) / p.avg_cost) * 100,
      }
    })

    const stocksValue = positionsWithPrices.reduce((s, p) => s + p.current_value, 0)
    const totalValue = player.cash + stocksValue
    // Use the player's own starting_cash (supports custom amounts)
    const startingCash = player.starting_cash ?? bracket.starting_cash

    // Snapshot at most once per hour
    const lastSnap = db.prepare(
      'SELECT created_at FROM snapshots WHERE player_id = ? ORDER BY id DESC LIMIT 1'
    ).get(playerId) as { created_at: string } | undefined
    if (!lastSnap || Date.now() - new Date(lastSnap.created_at).getTime() > 60 * 60 * 1000) {
      db.prepare('INSERT INTO snapshots (player_id, total_value) VALUES (?, ?)').run(playerId, totalValue)
    }

    const snapshots = db.prepare(
      'SELECT total_value, created_at FROM snapshots WHERE player_id = ? ORDER BY created_at ASC'
    ).all(playerId) as Snapshot[]

    return NextResponse.json({
      player: { id: player.id, name: player.name, bracket_id: player.bracket_id, is_private: !!player.is_private },
      bracket, startingCash, cash: player.cash, positions: positionsWithPrices, totalValue, snapshots,
    })
  } catch (err) {
    console.error('Portfolio error:', err)
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 })
  }
}
