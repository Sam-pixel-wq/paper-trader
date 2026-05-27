import { NextResponse, type NextRequest } from 'next/server'
import { searchSymbols } from '@/lib/marketData'
import { mockSearch } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  try {
    const results = await searchSymbols(q)
    if (results.length > 0) return NextResponse.json(results)
    // Fall back to mock search
    return NextResponse.json(mockSearch(q))
  } catch {
    return NextResponse.json(mockSearch(q))
  }
}
