import { NextResponse, type NextRequest } from 'next/server'
import { getDb, ensureInit, type Txn } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const playerId = parseInt(req.nextUrl.searchParams.get('player') ?? '0')
  if (!playerId) return NextResponse.json({ error: 'Missing player' }, { status: 400 })

  await ensureInit()
  const db = getDb()
  const txns = (await db.execute({
    sql: 'SELECT * FROM txns WHERE player_id = ? ORDER BY created_at DESC LIMIT 200',
    args: [playerId],
  })).rows as unknown as Txn[]
  return NextResponse.json(txns)
}
