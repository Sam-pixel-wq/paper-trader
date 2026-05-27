import { NextResponse } from 'next/server'
import { fetchQuote, yahooErrorMessage } from '@/lib/marketData'
import { getMockQuote } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params
  try {
    const q = await fetchQuote(ticker)
    return NextResponse.json(q)
  } catch (err) {
    // Fall back to mock data when Yahoo Finance is unavailable
    try {
      return NextResponse.json(getMockQuote(ticker))
    } catch {
      return NextResponse.json({ error: yahooErrorMessage(err) }, { status: 404 })
    }
  }
}
