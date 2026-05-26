import { NextResponse } from 'next/server'
import { fetchQuote, yahooErrorMessage } from '@/lib/marketData'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params
  try {
    const q = await fetchQuote(ticker)
    return NextResponse.json(q)
  } catch (err) {
    return NextResponse.json({ error: yahooErrorMessage(err) }, { status: 404 })
  }
}
