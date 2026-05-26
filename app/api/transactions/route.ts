import { NextResponse, type NextRequest } from 'next/server'
import { getDb, type Txn } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const playerId = parseInt(req.nextUrl.searchParams.get('player') ?? '0')
  if (!playerId) return NextResponse.json({ error: 'Missing player' }, { status: 400 })

  const db = getDb()
  const txns = db.prepare(
    'SELECT * FROM txns WHERE player_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(playerId) as Txn[]
  return NextResponse.json(txns)
}
