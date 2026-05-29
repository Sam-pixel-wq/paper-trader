import { NextResponse, type NextRequest } from 'next/server'
import { getDb, type Position, type Player, type Bracket } from '@/lib/db'
import { fetchQuote, yahooErrorMessage } from '@/lib/marketData'
import { getMockQuote } from '@/lib/mockData'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    player_id: number; ticker: string; type: string; shares: number
  }
  const { player_id, ticker, type, shares } = body

  if (!player_id) return NextResponse.json({ error: 'Missing player_id' }, { status: 400 })
  if (!ticker || (type !== 'buy' && type !== 'sell') || !shares || shares <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    let quoteData
    try {
      quoteData = await fetchQuote(ticker)
    } catch {
      quoteData = getMockQuote(ticker)
    }
    const price = quoteData?.price as number | undefined
    if (!price) return NextResponse.json({ error: 'Could not get current price' }, { status: 400 })

    const total = price * shares
    const db = getDb()
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(player_id) as Player | undefined
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    const bracket = db.prepare('SELECT * FROM brackets WHERE id = ?').get(player.bracket_id) as Bracket

    if (type === 'buy') {
      if (player.cash < total) {
        return NextResponse.json({
          error: `Insufficient funds. Need $${total.toFixed(2)}, have $${player.cash.toFixed(2)}`
        }, { status: 400 })
      }
      const existing = db.prepare(
        'SELECT * FROM positions WHERE player_id = ? AND ticker = ?'
      ).get(player_id, ticker) as Position | undefined

      const newShares = (existing?.shares ?? 0) + shares
      const newAvgCost = existing
        ? (existing.avg_cost * existing.shares + price * shares) / newShares
        : price

      db.transaction(() => {
        db.prepare('UPDATE players SET cash = cash - ? WHERE id = ?').run(total, player_id)
        db.prepare(`
          INSERT INTO positions (player_id, ticker, shares, avg_cost) VALUES (?,?,?,?)
          ON CONFLICT(player_id, ticker) DO UPDATE SET shares = excluded.shares, avg_cost = excluded.avg_cost
        `).run(player_id, ticker, newShares, newAvgCost)
        db.prepare(
          'INSERT INTO txns (player_id,ticker,type,shares,price,total) VALUES (?,?,?,?,?,?)'
        ).run(player_id, ticker, 'buy', shares, price, total)
      })()

    } else {
      const existing = db.prepare(
        'SELECT * FROM positions WHERE player_id = ? AND ticker = ?'
      ).get(player_id, ticker) as Position | undefined

      if (!existing || existing.shares < shares - 0.0001) {
        return NextResponse.json({
          error: `Insufficient shares. Have ${existing?.shares ?? 0}`
        }, { status: 400 })
      }
      const remaining = existing.shares - shares

      db.transaction(() => {
        db.prepare('UPDATE players SET cash = cash + ? WHERE id = ?').run(total, player_id)
        if (remaining < 0.0001) {
          db.prepare('DELETE FROM positions WHERE player_id = ? AND ticker = ?').run(player_id, ticker)
        } else {
          db.prepare('UPDATE positions SET shares = ? WHERE player_id = ? AND ticker = ?').run(
            remaining, player_id, ticker
          )
        }
        db.prepare(
          'INSERT INTO txns (player_id,ticker,type,shares,price,total) VALUES (?,?,?,?,?,?)'
        ).run(player_id, ticker, 'sell', shares, price, total)
      })()
    }

    const updated = db.prepare('SELECT cash FROM players WHERE id = ?').get(player_id) as { cash: number }
    return NextResponse.json({
      success: true, price, total, cash: updated.cash,
      bracket_starting: bracket.starting_cash,
    })
  } catch (err) {
    console.error('Trade error:', err)
    return NextResponse.json({ error: yahooErrorMessage(err) }, { status: 500 })
  }
}
