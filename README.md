# PaperTrader

Virtual stock trading with **real market data** and **no real money**. Start with $100,000 in paper cash, build a portfolio, and track performance over time.

## Features

- Live quotes and historical charts (Yahoo Finance via `yahoo-finance2`)
- Buy and sell stocks at current market prices
- Portfolio dashboard with holdings, P&L, and cash balance
- Portfolio value chart that records snapshots over time
- Full trade history

## Quick start

```bash
cd ~/paper-trader
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the browser shows **connection refused** or trades fail after code changes:

```bash
npm run restart
```

That clears a stale Next.js cache and restarts the server on port 3000.

## How it works

- **Paper money**: SQLite stores your cash, positions, and transactions locally in `data/paper-trader.db`.
- **Real prices**: API routes fetch live quotes when you trade or refresh the portfolio.
- **Progression**: Each portfolio refresh saves a value snapshot (at most once per hour, and after every trade) so the portfolio chart shows how your total value changes.

No API keys required.
