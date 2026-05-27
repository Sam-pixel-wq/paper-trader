/**
 * Portfolio price engine — two modes:
 *
 * MARKET OPEN  (ET 9:30–16:00, Mon–Fri)
 *   → live price from Yahoo Finance v8/chart, cached 45 s
 *
 * MARKET CLOSED (nights, weekends, holidays)
 *   → deterministic Geometric Brownian Motion simulation seeded by
 *     (ticker + last-close date).  Everyone who loads the app at the
 *     same moment sees the same price; it advances every 5 minutes
 *     and is bounded to ±6 % of the real closing price.
 *     Switches back to live data the moment the market opens.
 */

// ─── market-hours helpers ─────────────────────────────────────────────────────

function isMarketOpen(): boolean {
  try {
    const et   = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day  = et.getDay()
    if (day === 0 || day === 6) return false
    const mins = et.getHours() * 60 + et.getMinutes()
    return mins >= 570 && mins < 960   // 9:30 → 16:00
  } catch { return false }
}

/** Number of seconds since the last 4 PM ET weekday close. */
function secondsSinceLastClose(): number {
  const et      = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day     = et.getDay()
  const mins    = et.getHours() * 60 + et.getMinutes()
  const CLOSE_MINS = 16 * 60                          // 4 PM = 960 min
  const et_secs    = et.getSeconds()

  if (day >= 1 && day <= 5 && mins >= CLOSE_MINS)
    return (mins - CLOSE_MINS) * 60 + et_secs
  if (day >= 1 && day <= 5 && mins < 9 * 60 + 30) {
    const back = day === 1 ? 3 : 1
    return (back * 24 * 60 - CLOSE_MINS + mins) * 60 + et_secs
  }
  if (day === 6) return ((24 * 60 - CLOSE_MINS) + mins) * 60 + et_secs
  if (day === 0) return ((48 * 60 - CLOSE_MINS) + mins) * 60 + et_secs
  return 0
}

/**
 * Stable date-string for the session whose close we're simulating from.
 * Friday close seeds Saturday, Sunday, and Monday pre-market identically
 * so the curve is continuous across a weekend.
 */
function sessionSeedDate(): string {
  const et  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const min = et.getHours() * 60 + et.getMinutes()

  if (day === 0)                       et.setDate(et.getDate() - 2)   // Sun  → Fri
  else if (day === 6)                  et.setDate(et.getDate() - 1)   // Sat  → Fri
  else if (day === 1 && min < 570)     et.setDate(et.getDate() - 3)   // Mon pre-open → Fri
  else if (day >= 2 && min < 570)      et.setDate(et.getDate() - 1)   // Tue–Fri pre-open → yesterday

  return `${et.getFullYear()}-${et.getMonth()}-${et.getDate()}`
}

// ─── math helpers ─────────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Mulberry32 seeded PRNG — fast, good distribution */
function seededRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t     = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller: two uniform samples → one standard-normal sample */
function randNorm(rng: () => number): number {
  let u: number
  do { u = rng() } while (u === 0)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/**
 * Simulate a closed-market price via GBM.
 *
 * @param ticker     stock symbol (used as part of the seed)
 * @param lastClose  the last real traded/closing price from Yahoo
 * @returns          simulated price, clamped to ±6 % of lastClose
 */
function simulatePrice(ticker: string, lastClose: number): number {
  const steps = Math.floor(secondsSinceLastClose() / 10)  // one bar per 10 seconds
  if (steps === 0) return lastClose

  // 4 % daily vol → punchy moves visible within seconds
  const DAILY_VOL = 0.04
  const BARS_PER_DAY = 78 * 30                            // 30 ten-second bars per 5-min bar
  const BAR_VOL   = DAILY_VOL / Math.sqrt(BARS_PER_DAY)

  const seed = hashStr(ticker + sessionSeedDate())
  const rng  = seededRng(seed)

  let price = lastClose
  for (let i = 0; i < steps; i++) {
    price *= Math.exp((-0.5 * BAR_VOL * BAR_VOL) + BAR_VOL * randNorm(rng))
  }

  // Clamp overnight drift to ±6 % so moves stay believable
  const cap = lastClose * 0.06
  return Math.min(Math.max(price, lastClose - cap), lastClose + cap)
}

// ─── fetch + cache ────────────────────────────────────────────────────────────

interface CacheEntry { price: number; expires: number }
const _cache: Map<string, CacheEntry> = new Map()

const LIVE_TTL   = 3_000   // 3 s — always fresh before the 5 s UI refresh fires
const CLOSED_TTL = 3_000   // 3 s — sim bar is 10 s, so 3 s cache keeps it snappy

async function fetchRealPrice(ticker: string): Promise<number | null> {
  const hit = _cache.get(ticker)
  if (hit && hit.expires > Date.now()) return hit.price

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      cache: 'no-store',   // never let Next.js serve a stale disk-cached response
    })
    if (!res.ok) return null

    const json  = await res.json()
    const price: number | undefined = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (price == null || Number.isNaN(price)) return null

    _cache.set(ticker, { price, expires: Date.now() + (isMarketOpen() ? LIVE_TTL : CLOSED_TTL) })
    return price
  } catch {
    return null
  }
}

async function getCurrentPrice(ticker: string): Promise<number | null> {
  const real = await fetchRealPrice(ticker)
  if (real != null) {
    return isMarketOpen() ? real : simulatePrice(ticker, real)
  }
  // Yahoo unavailable — use mock price so positions still show a value
  try {
    const { getMockQuote } = await import('./mockData')
    return getMockQuote(ticker).price
  } catch {
    return null
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Resolve current prices for every ticker.
 * Returns only the tickers that successfully resolved;
 * missing ones should fall back to avg_cost in the caller.
 */
export async function getPrices(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}

  const settled = await Promise.allSettled(
    tickers.map(async t => ({ ticker: t, price: await getCurrentPrice(t) }))
  )

  const out: Record<string, number> = {}
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.price != null) {
      out[r.value.ticker] = r.value.price
    }
  }
  return out
}
