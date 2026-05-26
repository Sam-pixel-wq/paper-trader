'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

interface Point { date: string; close: number; prevClose?: number }

const PERIODS = ['1d', '1w', '1mo', '3mo', '1y', '5y'] as const
type Period = typeof PERIODS[number]

const PERIOD_LABELS: Record<Period, string> = {
  '1d': '1D', '1w': '1W', '1mo': '1M', '3mo': '3M', '1y': '1Y', '5y': '5Y',
}

/** True if US equity markets are currently open (ET 9:30–16:00, Mon–Fri) */
function isMarketOpen(): boolean {
  try {
    const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = et.getDay()
    if (day === 0 || day === 6) return false
    const mins = et.getHours() * 60 + et.getMinutes()
    return mins >= 570 && mins < 960   // 9:30 → 16:00
  } catch { return false }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">${payload[0].value?.toFixed(2)}</p>
    </div>
  )
}

export default function StockChart({ ticker }: { ticker: string }) {
  const marketOpen = isMarketOpen()

  // Default to live intraday when market is open, otherwise monthly historical
  const [period,  setPeriod]  = useState<Period>(marketOpen ? '1d' : '1mo')
  const [data,    setData]    = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(ticker)}?period=${period}`)
      if (res.ok) setData(await res.json())
    } catch { /* network blip — keep previous data */ } finally {
      if (!silent) setLoading(false)
    }
  }, [ticker, period])

  useEffect(() => {
    setData([])
    load()

    // When viewing live intraday, poll every 30 s for fresh price data
    if (timerRef.current) clearInterval(timerRef.current)
    if (period === '1d' && isMarketOpen()) {
      timerRef.current = setInterval(() => load(true), 30_000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  // Colour: compare to previous close (1D) or first→last point (other periods)
  const prevClose  = data[0]?.prevClose
  const lastClose  = data.at(-1)?.close ?? null
  const firstClose = data[0]?.close    ?? null
  const baseline   = period === '1d' && prevClose != null ? prevClose : firstClose
  const isUp       = lastClose != null && baseline != null ? lastClose >= baseline : true
  const color      = isUp ? '#34d399' : '#f87171'

  // Y-axis domain — ensure the previous-close reference line is always visible
  const prices    = data.map(d => d.close)
  const dataMin   = prices.length ? Math.min(...prices) : 0
  const dataMax   = prices.length ? Math.max(...prices) : 0
  const pad       = (dataMax - dataMin) * 0.08 || dataMax * 0.02
  const domainMin = Math.max(0, Math.min(dataMin - pad, prevClose != null ? prevClose * 0.998 : Infinity))
  const domainMax = dataMax + pad

  const isLive   = period === '1d' && marketOpen
  const showGrid = period !== '1d'
  // Show ~6 time labels for intraday, preserve start/end for multi-day
  const xInterval = period === '1d'
    ? (Math.max(1, Math.floor(data.length / 6)) as number)
    : ('preserveStartEnd' as const)

  return (
    <div>
      {/* ── Period buttons + status badge ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold ml-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        ) : period === '1d' ? (
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">Market Closed</span>
        ) : null}
      </div>

      {/* ── Chart body ── */}
      {loading ? (
        <div className="flex items-center justify-center h-44 text-gray-500 text-sm">
          Loading chart…
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-gray-500 text-sm text-center px-4">
          {period === '1d' && !marketOpen
            ? 'Market is closed — try 1W or 1M to see historical data.'
            : 'No chart data available.'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>

            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />}

            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={xInterval}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
              width={54}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Previous-close dashed line — only on 1D view */}
            {period === '1d' && prevClose != null && (
              <ReferenceLine
                y={prevClose}
                stroke="#4b5563"
                strokeDasharray="4 3"
                label={{
                  value: `Close $${prevClose.toFixed(2)}`,
                  position: 'insideTopRight',
                  fill: '#6b7280',
                  fontSize: 9,
                }}
              />
            )}

            <Area
              type={period === '1d' ? 'linear' : 'monotone'}
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${ticker})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
