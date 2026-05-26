import { getDb, type Position } from './db'
import { fetchQuote } from './marketData'

export async function computeTotalValue(): Promise<number> {
  const db = getDb()
  const account = db.prepare('SELECT cash FROM account WHERE id = 1').get() as { cash: number }
  const positions = db.prepare('SELECT * FROM positions').all() as Position[]

  if (positions.length === 0) return account.cash

  const results = await Promise.allSettled(positions.map(p => fetchQuote(p.ticker)))

  let stocksValue = 0
  results.forEach((res, i) => {
    const p = positions[i]
    const price =
      res.status === 'fulfilled' ? (res.value.price as number) : p.avg_cost
    stocksValue += price * p.shares
  })

  return account.cash + stocksValue
}

export async function recordPortfolioSnapshot(): Promise<void> {
  const totalValue = await computeTotalValue()
  getDb().prepare('INSERT INTO snapshots (total_value) VALUES (?)').run(totalValue)
}
