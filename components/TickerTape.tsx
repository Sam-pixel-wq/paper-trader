'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Item { ticker: string; price: number; changePct: number; change: number }

export default function TickerTape() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/stocks?category=trending')
        const data = await res.json()
        setItems(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((d: any) => ({
            ticker:    d.ticker,
            price:     d.price,
            changePct: d.changePct,
            change:    d.change,
          }))
        )
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  if (items.length === 0) return null

  // Duplicate list so the CSS translate-50% loop is seamless
  const doubled = [...items, ...items]

  return (
    <div className="relative overflow-hidden bg-gray-950 border-b border-gray-800/60 select-none">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-gray-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-gray-950 to-transparent" />

      <div
        className="flex whitespace-nowrap animate-ticker"
        style={{ width: 'max-content' }}
      >
        {doubled.map((item, i) => {
          const up = item.changePct >= 0
          return (
            <span
              key={`${item.ticker}-${i}`}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs"
            >
              <span className="font-mono font-semibold text-gray-300">{item.ticker}</span>
              <span className="text-white font-medium">${item.price.toFixed(2)}</span>
              <span className={`flex items-center gap-0.5 font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {up ? '+' : ''}{item.changePct.toFixed(2)}%
              </span>
              <span className="text-gray-700 text-[10px]">|</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
