import { NextResponse, type NextRequest } from 'next/server'
import { fetchHistory } from '@/lib/marketData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params
  const period = req.nextUrl.searchParams.get('period') || '1mo'

  try {
    const data = await fetchHistory(ticker, period)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
