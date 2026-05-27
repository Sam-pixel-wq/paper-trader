'use client'
import { useState, useEffect, useRef } from 'react'
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

function isMarketOpen(): boolean {
  try {
    const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = et.getDay()
    if (day === 0 || day === 6) return false
    const mins = et.getHours() * 60 + et.getMinutes()
    return mins >= 570 && mins < 960
  } catch { return false }
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ── Generates a unique intraday simulation seeded by ticker + date ─────────────
function simulateIntraday(ticker: string, basePrice: number): Point[] {
  const today = new Date().toISOString().slice(0, 10)
  const rand  = mulberry32(hashStr(ticker + '::' + today))

  // Per-stock personality: volatility, drift, and opening gap
  const vol        = 0.0006 + rand() * 0.0035   // 0.06 – 0.41 % per 5-min bar
  const driftBias  = (rand() - 0.5) * 0.00015   // slight up or down tendency
  const openGapPct = (rand() - 0.5) * 0.008      // ±0.4 % opening gap

  const pts: Point[] = []
  let px = basePrice * (1 + openGapPct)

  for (let i = 0; i < 79; i++) {
    const totalMins = 9 * 60 + 30 + i * 5        // 9:30 → 16:00
    const h  = Math.floor(totalMins / 60)
    const m  = totalMins % 60
    const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h)
    const ampm = h < 12 ? 'AM' : 'PM'
    const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`

    if (i > 0) {
      const noise   = (rand() - 0.5) * 2 * vol * px
      const revert  = (basePrice - px) * 0.013    // gentle mean-reversion
      px += noise + revert + driftBias * px
      px = Math.max(0.01, px)
    }

    pts.push({ date: label, close: +px.toFixed(2), prevClose: basePrice })
  }

  return pts
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

interface Props {
  ticker: string
  /** Current live price — used as the base for the after-hours simulation */
  currentPrice?: number
}

export default function StockChart({ ticker, currentPrice }: Props) {
  const marketOpen = isMarketOpen()

  const [period,   setPeriod]   = useState<Period>(marketOpen ? '1d' : '1mo')
  const [data,     setData]     = useState<Point[]>([])
  const [simData,  setSimData]  = useState<Point[]>([])
  const [loading,  setLoading]  = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSimulated = period === '1d' && !marketOpen

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    setData([])
    setSimData([])

    if (isSimulated) {
      // Market is closed — generate a simulated intraday curve immediately
      const base = currentPrice ?? 100
      setSimData(simulateIntraday(ticker, base))
      setLoading(false)
      return
    }

    // Market is open (or non-1D period) — fetch real history
    let cancelled = false
    setLoading(true)

    const doFetch = async (silent: boolean) => {
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(ticker)}?period=${period}`)
        if (res.ok && !cancelled) setData(await res.json())
      } catch { /* network blip — keep previous data */ } finally {
        if (!silent && !cancelled) setLoading(false)
      }
    }

    doFetch(false)

    if (timerRef.current) clearInterval(timerRef.current)
    if (period === '1d' && marketOpen) {
      timerRef.current = setInterval(() => doFetch(true), 30_000)
    }

    return () => {
      cancelled = true
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, period, isSimulated, currentPrice])

  // ── Chart colours ─────────────────────────────────────────────────────────
  const displayData = isSimulated ? simData : data
  const prevClose   = displayData[0]?.prevClose
  const lastClose   = displayData.at(-1)?.close  ?? null
  const firstClose  = displayData[0]?.close      ?? null
  const baseline    = period === '1d' && prevClose != null ? prevClose : firstClose
  const isUp        = lastClose != null && baseline != null ? lastClose >= baseline : true
  const color       = isUp ? '#34d399' : '#f87171'
  const simColor    = '#a78bfa'   // purple for simulated

  const prices    = displayData.map(d => d.close)
  const dataMin   = prices.length ? Math.min(...prices) : 0
  const dataMax   = prices.length ? Math.max(...prices) : 0
  const pad       = (dataMax - dataMin) * 0.08 || dataMax * 0.02
  const domainMin = Math.max(0, Math.min(dataMin - pad, prevClose != null ? prevClose * 0.997 : Infinity))
  const domainMax = dataMax + pad

  const isLive     = period === '1d' && marketOpen
  const showGrid   = period !== '1d'
  const xInterval  = period === '1d'
    ? (Math.max(1, Math.floor(displayData.length / 6)) as number)
    : ('preserveStartEnd' as const)

  const lineColor = isSimulated ? simColor : color

  return (
    <div>
      {/* ── Period selector + status badge ─────────────────────────────── */}
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
        ) : isSimulated ? (
          <span className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold ml-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            SIMULATED
          </span>
        ) : period === '1d' ? (
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">Market Closed</span>
        ) : null}
      </div>

      {/* ── Chart body ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-44 text-gray-500 text-sm">
          Loading chart…
        </div>
      ) : displayData.length === 0 ? (
        <div className="flex items-center justify-center h-44 text-gray-500 text-sm text-center px-4">
          No chart data available.
        </div>
      ) : (
        <div className="relative">
          {/* Simulation disclaimer */}
          {isSimulated && (
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
              <span className="text-[9px] text-purple-400/70 bg-purple-950/40 border border-purple-900/40 px-2.5 py-0.5 rounded-full">
                ✦ Simulated after-hours curve · unique to {ticker} · resets each trading day
              </span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={displayData} margin={{ top: isSimulated ? 18 : 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${ticker}-${isSimulated ? 'sim' : 'real'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={isSimulated ? 0.12 : 0.28} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
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

              {period === '1d' && prevClose != null && (
                <ReferenceLine
                  y={prevClose}
                  stroke={isSimulated ? '#7c3aed' : '#4b5563'}
                  strokeDasharray="4 3"
                  label={{
                    value: isSimulated ? `Base $${prevClose.toFixed(2)}` : `Close $${prevClose.toFixed(2)}`,
                    position: 'insideTopRight',
                    fill: isSimulated ? '#7c3aed' : '#6b7280',
                    fontSize: 9,
                  }}
                />
              )}

              <Area
                type={period === '1d' ? 'linear' : 'monotone'}
                dataKey="close"
                stroke={lineColor}
                strokeWidth={isSimulated ? 1.5 : 2}
                strokeDasharray={isSimulated ? '6 3' : undefined}
                fill={`url(#grad-${ticker}-${isSimulated ? 'sim' : 'real'})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
