/**
 * Mock market data generator.
 *
 * When Yahoo Finance is unavailable (e.g. network-restricted environments),
 * all API routes fall back here.  Prices are deterministic: seeded by
 * ticker + calendar date so refreshing gives the same number but each new
 * day gives a fresh value.  Each ticker has its own volatility profile so
 * every stock "feels" different.
 */

// ── Seeded PRNG ──────────────────────────────────────────────────────────────
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

function seededRand(ticker: string, salt: string) {
  return mulberry32(hashStr(ticker + '::' + salt))
}

// Box-Muller normal variate, σ=1
function normal(rand: () => number) {
  const u = 1 - rand()
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── Reference prices (approx. late-2024 levels) ──────────────────────────────
export const BASE_PRICES: Record<string, { price: number; name: string; vol: number; cap: number; pe?: number }> = {
  // Trending
  NVDA:  { price: 875,  name: 'NVIDIA Corporation',           vol: 0.038, cap: 2_150e9, pe: 55  },
  TSLA:  { price: 245,  name: 'Tesla, Inc.',                  vol: 0.045, cap:  780e9, pe: 70  },
  AAPL:  { price: 225,  name: 'Apple Inc.',                   vol: 0.020, cap: 3_480e9, pe: 33  },
  META:  { price: 580,  name: 'Meta Platforms, Inc.',         vol: 0.030, cap: 1_480e9, pe: 28  },
  AMZN:  { price: 220,  name: 'Amazon.com, Inc.',             vol: 0.025, cap: 2_300e9, pe: 45  },
  GOOGL: { price: 180,  name: 'Alphabet Inc.',                vol: 0.022, cap: 2_200e9, pe: 24  },
  MSFT:  { price: 420,  name: 'Microsoft Corporation',        vol: 0.020, cap: 3_120e9, pe: 36  },
  AMD:   { price: 155,  name: 'Advanced Micro Devices, Inc.', vol: 0.040, cap:  250e9, pe: 48  },
  NFLX:  { price: 750,  name: 'Netflix, Inc.',                vol: 0.032, cap:  320e9, pe: 42  },
  PLTR:  { price: 42,   name: 'Palantir Technologies Inc.',   vol: 0.055, cap:   90e9, pe: 185 },
  // Tech
  INTC:  { price: 22,   name: 'Intel Corporation',            vol: 0.028, cap:   93e9, pe: 18  },
  CRM:   { price: 310,  name: 'Salesforce, Inc.',             vol: 0.028, cap:  298e9, pe: 48  },
  ORCL:  { price: 180,  name: 'Oracle Corporation',           vol: 0.025, cap:  490e9, pe: 38  },
  SNOW:  { price: 170,  name: 'Snowflake Inc.',               vol: 0.048, cap:   58e9, pe: 310 },
  // Finance
  JPM:   { price: 245,  name: 'JPMorgan Chase & Co.',         vol: 0.018, cap:  703e9, pe: 13  },
  BAC:   { price: 45,   name: 'Bank of America Corporation',  vol: 0.020, cap:  355e9, pe: 13  },
  GS:    { price: 560,  name: 'The Goldman Sachs Group, Inc.',vol: 0.022, cap:  193e9, pe: 16  },
  MS:    { price: 115,  name: 'Morgan Stanley',               vol: 0.020, cap:  186e9, pe: 17  },
  WFC:   { price: 72,   name: 'Wells Fargo & Company',        vol: 0.020, cap:  245e9, pe: 12  },
  C:     { price: 68,   name: 'Citigroup Inc.',               vol: 0.022, cap:  132e9, pe: 12  },
  BLK:   { price: 1050, name: 'BlackRock, Inc.',              vol: 0.018, cap:  156e9, pe: 22  },
  AXP:   { price: 310,  name: 'American Express Company',     vol: 0.020, cap:  224e9, pe: 21  },
  V:     { price: 315,  name: 'Visa Inc.',                    vol: 0.016, cap:  649e9, pe: 31  },
  MA:    { price: 530,  name: 'Mastercard Incorporated',      vol: 0.016, cap:  494e9, pe: 38  },
  // Healthcare
  JNJ:   { price: 155,  name: 'Johnson & Johnson',            vol: 0.012, cap:  372e9, pe: 16  },
  PFE:   { price: 28,   name: 'Pfizer Inc.',                  vol: 0.018, cap:  158e9, pe: 12  },
  UNH:   { price: 550,  name: 'UnitedHealth Group Incorporated',vol:0.015, cap: 508e9, pe: 22 },
  ABBV:  { price: 195,  name: 'AbbVie Inc.',                  vol: 0.018, cap:  343e9, pe: 20  },
  MRK:   { price: 115,  name: 'Merck & Co., Inc.',            vol: 0.015, cap:  291e9, pe: 15  },
  BMY:   { price: 58,   name: 'Bristol-Myers Squibb Company', vol: 0.018, cap:  115e9, pe: 14  },
  AMGN:  { price: 290,  name: 'Amgen Inc.',                   vol: 0.018, cap:  155e9, pe: 17  },
  GILD:  { price: 88,   name: 'Gilead Sciences, Inc.',        vol: 0.020, cap:  110e9, pe: 13  },
  LLY:   { price: 870,  name: 'Eli Lilly and Company',        vol: 0.025, cap:  825e9, pe: 65  },
  MRNA:  { price: 46,   name: 'Moderna, Inc.',                vol: 0.055, cap:   18e9 },
  // Energy
  XOM:   { price: 115,  name: 'Exxon Mobil Corporation',      vol: 0.020, cap:  460e9, pe: 14  },
  CVX:   { price: 155,  name: 'Chevron Corporation',          vol: 0.018, cap:  286e9, pe: 14  },
  COP:   { price: 115,  name: 'ConocoPhillips',               vol: 0.022, cap:  140e9, pe: 12  },
  SLB:   { price: 47,   name: 'SLB',                          vol: 0.025, cap:   67e9, pe: 14  },
  EOG:   { price: 130,  name: 'EOG Resources, Inc.',          vol: 0.022, cap:   77e9, pe: 11  },
  MPC:   { price: 178,  name: 'Marathon Petroleum Corporation',vol:0.022, cap:   60e9, pe: 9   },
  VLO:   { price: 155,  name: 'Valero Energy Corporation',    vol: 0.022, cap:   50e9, pe: 9   },
  OXY:   { price: 55,   name: 'Occidental Petroleum Corporation',vol:0.025,cap:  50e9, pe: 14  },
  HAL:   { price: 38,   name: 'Halliburton Company',          vol: 0.028, cap:   34e9, pe: 12  },
  DVN:   { price: 42,   name: 'Devon Energy Corporation',     vol: 0.030, cap:   27e9, pe: 8   },
  // ETFs
  SPY:   { price: 600,  name: 'SPDR S&P 500 ETF Trust',       vol: 0.012, cap: 550e9 },
  QQQ:   { price: 530,  name: 'Invesco QQQ Trust',            vol: 0.016, cap: 245e9 },
  DIA:   { price: 440,  name: 'SPDR Dow Jones Industrial Avg ETF',vol:0.011,cap:35e9 },
  IWM:   { price: 235,  name: 'iShares Russell 2000 ETF',     vol: 0.020, cap:  60e9 },
  VTI:   { price: 278,  name: 'Vanguard Total Stock Market ETF',vol:0.012,cap: 440e9 },
  GLD:   { price: 257,  name: 'SPDR Gold Shares',             vol: 0.010, cap:  70e9 },
  TLT:   { price: 88,   name: 'iShares 20+ Year Treasury Bond ETF',vol:0.010,cap:50e9},
  ARKK:  { price: 54,   name: 'ARK Innovation ETF',           vol: 0.045, cap:   7e9 },
  XLF:   { price: 48,   name: 'Financial Select Sector SPDR Fund',vol:0.016,cap:42e9},
  XLK:   { price: 235,  name: 'Technology Select Sector SPDR Fund',vol:0.018,cap:65e9},
}

// ── Derive a daily "close" price from the base ────────────────────────────────
function dailyClose(ticker: string, daysAgo: number): number {
  const meta = BASE_PRICES[ticker]
  if (!meta) return 100

  const dateRef = new Date()
  dateRef.setDate(dateRef.getDate() - daysAgo)
  const dateStr = dateRef.toISOString().slice(0, 10)

  const rand = seededRand(ticker, dateStr)
  // Cumulative walk from base: each day drifts by vol * normal
  let px = meta.price
  for (let i = daysAgo; i > 0; i--) {
    const dayStr = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const r = seededRand(ticker, dayStr)
    px *= 1 + meta.vol * 0.4 * normal(r)
    px = Math.max(0.01, px)
  }
  // Apply today's move
  const todayMove = meta.vol * 0.4 * normal(rand)
  px *= 1 + todayMove
  return Math.max(0.01, +px.toFixed(2))
}

// ── Market hours ──────────────────────────────────────────────────────────────
export function isMarketOpen(): boolean {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  if (day === 0 || day === 6) return false
  const mins = et.getHours() * 60 + et.getMinutes()
  return mins >= 570 && mins < 960
}

// ── Quote ─────────────────────────────────────────────────────────────────────
export function getMockQuote(ticker: string) {
  const sym  = ticker.toUpperCase()
  const meta = BASE_PRICES[sym] ?? { price: 50, name: sym, vol: 0.025, cap: 1e9 }
  const today = new Date().toISOString().slice(0, 10)

  const rand   = seededRand(sym, today)
  const vol    = meta.vol
  const px     = dailyClose(sym, 0)
  const prev   = dailyClose(sym, 1)
  const open   = prev * (1 + (rand() - 0.5) * 0.008)
  const change = px - prev
  const changePct = (change / prev) * 100
  const high   = Math.max(px, open) * (1 + rand() * 0.004)
  const low    = Math.min(px, open) * (1 - rand() * 0.004)

  const wkHigh = px * (1 + vol * 1.8 * rand())
  const wkLow  = px * (1 - vol * 1.5 * rand())

  return {
    ticker: sym,
    name:   meta.name,
    price:  +px.toFixed(2),
    change: +change.toFixed(2),
    changePct: +changePct.toFixed(4),
    open:   +open.toFixed(2),
    high:   +high.toFixed(2),
    low:    +low.toFixed(2),
    volume: Math.round(meta.cap / px * (0.003 + rand() * 0.008)),
    marketCap: meta.cap,
    pe:     meta.pe ?? null,
    fiftyTwoWeekHigh: +wkHigh.toFixed(2),
    fiftyTwoWeekLow:  +wkLow.toFixed(2),
  }
}

// ── Stocks list (for category grid) ──────────────────────────────────────────
export function getMockStocks(tickers: string[]) {
  return tickers.map(sym => {
    const q = getMockQuote(sym)
    const sparkline = Array.from({ length: 5 }, (_, i) => dailyClose(sym, 4 - i))
    return { ...q, sparkline }
  })
}

// ── Historical chart data ─────────────────────────────────────────────────────
export function getMockHistory(ticker: string, period: string) {
  const sym  = ticker.toUpperCase()
  const meta = BASE_PRICES[sym] ?? { price: 50, name: sym, vol: 0.025, cap: 1e9 }

  const marketOpen = isMarketOpen()
  const isIntraday = period === '1d'

  if (isIntraday) {
    // 5-minute bars 9:30 → 16:00
    const prev     = dailyClose(sym, 1)
    const rand     = seededRand(sym, new Date().toISOString().slice(0, 10) + ':intraday')
    const openPx   = prev * (1 + (rand() - 0.5) * 0.008)
    let   px       = openPx
    const driftBias = (rand() - 0.5) * 0.0001
    const vol      = meta.vol * 0.12   // 5-min vol

    const nowET     = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const nowMins   = nowET.getHours() * 60 + nowET.getMinutes()
    const marketMin = 570   // 9:30
    const closeMin  = 960   // 16:00

    const points = []
    for (let i = 0; i < 79; i++) {
      const totalMins = marketMin + i * 5
      if (marketOpen && totalMins > nowMins) break  // don't draw future bars when live

      const h    = Math.floor(totalMins / 60)
      const m    = totalMins % 60
      const h12  = h > 12 ? h - 12 : (h === 0 ? 12 : h)
      const ampm = h < 12 ? 'AM' : 'PM'
      const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`

      if (i > 0) {
        const noise  = (rand() - 0.5) * 2 * vol * px
        const revert = (prev - px) * 0.01 + driftBias * px
        px = Math.max(0.01, px + noise + revert)
      }
      points.push({ date: label, close: +px.toFixed(2), prevClose: prev })
    }
    return points
  }

  // Multi-day periods
  const days =
    period === '1w'  ? 5  :
    period === '1mo' ? 22 :
    period === '3mo' ? 65 :
    period === '1y'  ? 252 :
    period === '5y'  ? 1260 : 22

  const interval = period === '1y' || period === '5y' ? 7 : 1  // weekly for long periods

  const points = []
  const step   = interval
  for (let i = days; i >= 0; i -= step) {
    const date = new Date(Date.now() - i * 86400000)
    const dow  = date.getDay()
    if (dow === 0 || dow === 6) continue   // skip weekends
    const label = date.toISOString().slice(0, 10)
    points.push({ date: label, close: dailyClose(sym, i) })
  }
  return points
}

// ── Search ────────────────────────────────────────────────────────────────────
export function mockSearch(query: string) {
  const q = query.toLowerCase()
  return Object.entries(BASE_PRICES)
    .filter(([sym, m]) => sym.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map(([sym, m]) => ({
      ticker:   sym,
      name:     m.name,
      exchange: 'NASDAQ',
      type:     'EQUITY',
    }))
}

// ── Mock news ─────────────────────────────────────────────────────────────────
const NEWS_POOL = [
  { title: 'Tech stocks rally as AI spending continues to surge across major cloud providers', publisher: 'MarketWatch',    relatedTickers: ['NVDA','MSFT','GOOGL','AMD'] },
  { title: 'Fed signals potential rate cuts ahead as inflation data shows further cooling',   publisher: 'Reuters',         relatedTickers: ['SPY','TLT','JPM','GS']     },
  { title: 'NVIDIA unveils next-generation GPU architecture, sending shares to new highs',   publisher: 'Bloomberg',       relatedTickers: ['NVDA','AMD','INTC']         },
  { title: 'Apple reports record quarterly revenue driven by iPhone 16 and services growth', publisher: 'CNBC',            relatedTickers: ['AAPL']                      },
  { title: 'Tesla deliveries beat expectations; company hints at new affordable model line', publisher: 'The Verge',       relatedTickers: ['TSLA']                      },
  { title: 'Meta\'s ad revenue soars 22% as Reels and AI-driven targeting pay off',         publisher: 'Wall Street Journal',relatedTickers:['META','GOOGL']             },
  { title: 'Amazon Web Services growth re-accelerates, boosting overall cloud market outlook',publisher:'TechCrunch',      relatedTickers: ['AMZN','MSFT','GOOGL']       },
  { title: 'Eli Lilly\'s weight-loss drug sales smash forecasts, widening lead over rivals', publisher: 'Bloomberg',      relatedTickers: ['LLY','MRNA','PFE']          },
  { title: 'Oil prices climb on Middle East tensions; energy sector outperforms the market', publisher: 'Reuters',         relatedTickers: ['XOM','CVX','COP','OXY']     },
  { title: 'JPMorgan upgrades outlook for financials as loan demand stabilises post-hike',  publisher: 'Financial Times', relatedTickers: ['JPM','BAC','GS','WFC']      },
  { title: 'S&P 500 closes at all-time high as economic soft-landing narrative strengthens', publisher: 'MarketWatch',    relatedTickers: ['SPY','QQQ','VTI']           },
  { title: 'Palantir secures major government AI contract worth $480 million',              publisher: 'Defense News',    relatedTickers: ['PLTR']                      },
  { title: 'Netflix subscriber growth exceeds estimates; ad-supported tier drives momentum', publisher: 'Variety',        relatedTickers: ['NFLX']                      },
  { title: 'Salesforce raises full-year guidance after strong AI-driven enterprise demand',  publisher: 'Fortune',        relatedTickers: ['CRM','MSFT','ORCL']         },
  { title: 'Mastercard and Visa both signal resilient consumer spending into year-end',     publisher: 'CNBC',            relatedTickers: ['MA','V','AXP']              },
  { title: 'UnitedHealth beats earnings; expands AI tools for claims and care management',  publisher: 'Reuters',         relatedTickers: ['UNH']                       },
  { title: 'Gold hits record high as dollar weakens on Fed pivot expectations',             publisher: 'Bloomberg',       relatedTickers: ['GLD','TLT']                 },
  { title: 'Small-cap stocks outperform as investors rotate out of mega-cap tech',         publisher: 'Barron\'s',       relatedTickers: ['IWM','QQQ','SPY']           },
  { title: 'Snowflake earnings disappoint on slowing cloud data warehouse growth',          publisher: 'TechCrunch',      relatedTickers: ['SNOW','CRM','ORCL']         },
  { title: 'Energy sector leads gains as crude inventory data beats expectations',          publisher: 'OilPrice.com',    relatedTickers: ['XOM','CVX','HAL','SLB']     },
]

export function getMockNews(tickers: string[] = []) {
  const today = new Date().toISOString().slice(0, 10)
  const rand  = seededRand('news', today)

  // Shuffle deterministically
  const pool  = [...NEWS_POOL].sort(() => rand() - 0.5)

  // If tickers provided, boost relevant articles
  let result = tickers.length > 0
    ? [
        ...pool.filter(n => n.relatedTickers.some(t => tickers.includes(t))),
        ...pool.filter(n => !n.relatedTickers.some(t => tickers.includes(t))),
      ]
    : pool

  return result.slice(0, 20).map((n, i) => ({
    id:            `mock-${today}-${i}`,
    title:         n.title,
    publisher:     n.publisher,
    url:           '#',
    publishedAt:   new Date(Date.now() - i * 900_000).toISOString(),
    thumbnail:     null,
    relatedTickers: n.relatedTickers,
  }))
}
