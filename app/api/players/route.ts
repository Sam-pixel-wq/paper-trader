import { NextResponse, type NextRequest } from 'next/server'
import { getDb, ensureInit, BRACKETS, type Player } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureInit()
  const db = getDb()
  const result = await db.execute(`
    SELECT p.*, b.name AS bracket_name, b.starting_cash AS bracket_starting_cash, b.emoji
    FROM players p
    JOIN brackets b ON b.id = p.bracket_id
    ORDER BY p.created_at ASC
  `)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string; bracket_id: string; custom_amount?: number; is_private?: boolean
  }
  const { name, bracket_id, custom_amount, is_private } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!BRACKETS.find(b => b.id === bracket_id)) {
    return NextResponse.json({ error: 'Invalid bracket' }, { status: 400 })
  }

  await ensureInit()
  const db = getDb()

  let starting_cash: number
  if (bracket_id === 'custom') {
    if (!custom_amount || custom_amount < 100) {
      return NextResponse.json({ error: 'Custom amount must be at least $100' }, { status: 400 })
    }
    if (custom_amount > 10_000_000) {
      return NextResponse.json({ error: 'Custom amount cannot exceed $10,000,000' }, { status: 400 })
    }
    starting_cash = custom_amount
  } else {
    const bRow = (await db.execute({ sql: 'SELECT * FROM brackets WHERE id = ?', args: [bracket_id] })).rows[0]
    starting_cash = bRow?.starting_cash as number
  }

  try {
    const ins = await db.execute({
      sql: 'INSERT INTO players (name, bracket_id, cash, starting_cash, is_private) VALUES (?, ?, ?, ?, ?)',
      args: [name.trim(), bracket_id, starting_cash, starting_cash, is_private ? 1 : 0],
    })
    const player = (await db.execute({
      sql: 'SELECT * FROM players WHERE id = ?',
      args: [ins.lastInsertRowid ?? 0],
    })).rows[0] as unknown as Player
    return NextResponse.json(player)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('UNIQUE')) return NextResponse.json({ error: 'That name is already taken' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
  }
}
