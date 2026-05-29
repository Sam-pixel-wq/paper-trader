import { NextResponse, type NextRequest } from 'next/server'
import { fetchHistory } from '@/lib/marketData'
import { getMockHistory } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params
  const period = req.nextUrl.searchParams.get('period') || '1mo'

  try {
    const data = await fetchHistory(ticker, period)
    if (data.length > 0) return NextResponse.json(data)
    // Real API returned empty — use mock
    return NextResponse.json(getMockHistory(ticker, period))
  } catch {
    return NextResponse.json(getMockHistory(ticker, period))
  }
}
