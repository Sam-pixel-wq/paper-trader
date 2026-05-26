import { NextResponse, type NextRequest } from 'next/server'
import { getDb, type Challenge, type Player } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface EntryRow {
  challenge_id: number; player_id: number; player_name: string
  starting_portfolio_value: number; joined_at: string; latest_value: number | null
}

function buildLeaderboard(entries: EntryRow[], currentPlayerId: number) {
  return entries
    .map(e => {
      const currentValue = e.latest_value ?? e.starting_portfolio_value
      const returnPct = e.starting_portfolio_value > 0
        ? ((currentValue - e.starting_portfolio_value) / e.starting_portfolio_value) * 100
        : 0
      return {
        player_id: e.player_id,
        name: e.player_name,
        return_pct: returnPct,
        current_value: currentValue,
        starting_value: e.starting_portfolio_value,
        joined_at: e.joined_at,
        is_you: e.player_id === currentPlayerId,
      }
    })
    .sort((a, b) => b.return_pct - a.return_pct)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

export async function GET(req: NextRequest) {
  const playerId = parseInt(req.nextUrl.searchParams.get('player') ?? '0')
  const db = getDb()

  const challenges = db.prepare(
    'SELECT * FROM challenges WHERE is_active = 1 ORDER BY id ASC'
  ).all() as Challenge[]

  const result = challenges.map(c => {
    // Get all entries with latest snapshot value
    const entries = db.prepare(`
      SELECT
        ce.challenge_id, ce.player_id, p.name AS player_name,
        ce.starting_portfolio_value, ce.joined_at,
        (SELECT s.total_value FROM snapshots s
         WHERE s.player_id = ce.player_id AND s.created_at >= ce.joined_at
         ORDER BY s.id DESC LIMIT 1) AS latest_value
      FROM challenge_entries ce
      JOIN players p ON p.id = ce.player_id
      WHERE ce.challenge_id = ?
    `).all(c.id) as EntryRow[]

    const leaderboard = buildLeaderboard(entries, playerId)
    const myEntry = playerId ? leaderboard.find(e => e.player_id === playerId) ?? null : null

    return {
      ...c,
      total_entries: entries.length,
      my_entry: myEntry,
      leaderboard: leaderboard.slice(0, 10),
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { player_id, challenge_id } = await req.json() as { player_id: number; challenge_id: number }
  if (!player_id || !challenge_id) {
    return NextResponse.json({ error: 'Missing player_id or challenge_id' }, { status: 400 })
  }

  const db = getDb()
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(player_id) as Player | undefined
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  // Get current portfolio value for the starting baseline
  const lastSnap = db.prepare(
    'SELECT total_value FROM snapshots WHERE player_id = ? ORDER BY id DESC LIMIT 1'
  ).get(player_id) as { total_value: number } | undefined

  // Estimate portfolio value: cash + positions at avg_cost (snapshot may be stale)
  const positions = db.prepare(
    'SELECT shares, avg_cost FROM positions WHERE player_id = ?'
  ).all(player_id) as { shares: number; avg_cost: number }[]
  const estimatedValue = lastSnap?.total_value
    ?? positions.reduce((s, p) => s + p.shares * p.avg_cost, player.cash)

  try {
    db.prepare(
      'INSERT OR IGNORE INTO challenge_entries (challenge_id, player_id, starting_portfolio_value) VALUES (?,?,?)'
    ).run(challenge_id, player_id, estimatedValue)
    return NextResponse.json({ success: true, starting_portfolio_value: estimatedValue })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { player_id, challenge_id } = await req.json() as { player_id: number; challenge_id: number }
  if (!player_id || !challenge_id) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }
  const db = getDb()
  db.prepare('DELETE FROM challenge_entries WHERE challenge_id = ? AND player_id = ?').run(challenge_id, player_id)
  return NextResponse.json({ success: true })
}
