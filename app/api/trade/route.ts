import { NextResponse, type NextRequest } from 'next/server'
import { getDb, ensureInit, type Position, type Player, type Bracket } from '@/lib/db'
import { fetchQuote, yahooErrorMessage } from '@/lib/marketData'

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
    const quoteData = await fetchQuote(ticker)
    const price = quoteData?.price as number | undefined
    if (!price) return NextResponse.json({ error: 'Could not get current price' }, { status: 400 })

    const total = price * shares

    await ensureInit()
    const db = getDb()

    const player = (await db.execute({ sql: 'SELECT * FROM players WHERE id = ?', args: [player_id] })).rows[0] as unknown as Player | undefined
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    const bracket = (await db.execute({ sql: 'SELECT * FROM brackets WHERE id = ?', args: [player.bracket_id] })).rows[0] as unknown as Bracket

    if (type === 'buy') {
      if (player.cash < total) {
        return NextResponse.json({
          error: `Insufficient funds. Need $${total.toFixed(2)}, have $${player.cash.toFixed(2)}`
        }, { status: 400 })
      }

      const existing = (await db.execute({
        sql: 'SELECT * FROM positions WHERE player_id = ? AND ticker = ?',
        args: [player_id, ticker],
      })).rows[0] as unknown as Position | undefined

      const newShares = (existing?.shares ?? 0) + shares
      const newAvgCost = existing
        ? (existing.avg_cost * existing.shares + price * shares) / newShares
        : price

      await db.batch([
        { sql: 'UPDATE players SET cash = cash - ? WHERE id = ?', args: [total, player_id] },
        {
          sql: `INSERT INTO positions (player_id, ticker, shares, avg_cost) VALUES (?,?,?,?)
                ON CONFLICT(player_id, ticker) DO UPDATE SET shares = excluded.shares, avg_cost = excluded.avg_cost`,
          args: [player_id, ticker, newShares, newAvgCost],
        },
        { sql: 'INSERT INTO txns (player_id,ticker,type,shares,price,total) VALUES (?,?,?,?,?,?)', args: [player_id, ticker, 'buy', shares, price, total] },
      ], 'write')

    } else {
      const existing = (await db.execute({
        sql: 'SELECT * FROM positions WHERE player_id = ? AND ticker = ?',
        args: [player_id, ticker],
      })).rows[0] as unknown as Position | undefined

      if (!existing || existing.shares < shares - 0.0001) {
        return NextResponse.json({
          error: `Insufficient shares. Have ${existing?.shares ?? 0}`
        }, { status: 400 })
      }
      const remaining = existing.shares - shares

      if (remaining < 0.0001) {
        await db.batch([
          { sql: 'UPDATE players SET cash = cash + ? WHERE id = ?', args: [total, player_id] },
          { sql: 'DELETE FROM positions WHERE player_id = ? AND ticker = ?', args: [player_id, ticker] },
          { sql: 'INSERT INTO txns (player_id,ticker,type,shares,price,total) VALUES (?,?,?,?,?,?)', args: [player_id, ticker, 'sell', shares, price, total] },
        ], 'write')
      } else {
        await db.batch([
          { sql: 'UPDATE players SET cash = cash + ? WHERE id = ?', args: [total, player_id] },
          { sql: 'UPDATE positions SET shares = ? WHERE player_id = ? AND ticker = ?', args: [remaining, player_id, ticker] },
          { sql: 'INSERT INTO txns (player_id,ticker,type,shares,price,total) VALUES (?,?,?,?,?,?)', args: [player_id, ticker, 'sell', shares, price, total] },
        ], 'write')
      }
    }

    const updated = (await db.execute({ sql: 'SELECT cash FROM players WHERE id = ?', args: [player_id] })).rows[0]
    return NextResponse.json({
      success: true, price, total, cash: updated?.cash,
      bracket_starting: bracket.starting_cash,
    })
  } catch (err) {
    console.error('Trade error:', err)
    return NextResponse.json({ error: yahooErrorMessage(err) }, { status: 500 })
  }
}
