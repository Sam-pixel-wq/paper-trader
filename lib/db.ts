import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'paper-trader.db')

let _db: Database.Database | null = null

export const BRACKETS = [
  { id: '5k',     name: 'Penny Pincher', starting_cash: 5_000,   emoji: '🌱', description: 'Start lean, think smart' },
  { id: '10k',    name: 'Day Trader',    starting_cash: 10_000,  emoji: '💼', description: 'Classic retail investor' },
  { id: '50k',    name: 'Swing Trader',  starting_cash: 50_000,  emoji: '📈', description: 'Bigger moves, bigger risks' },
  { id: '100k',   name: 'Whale',         starting_cash: 100_000, emoji: '🐋', description: 'Go big or go home' },
  { id: 'custom', name: 'Custom',        starting_cash: 0,       emoji: '✏️',  description: 'Pick your own starting amount' },
] as const

const DEFAULT_CHALLENGES = [
  { name: 'The 5% Club',      description: 'Grow your portfolio by 5% from the moment you join.',         icon: '🎯', target_pct: 5,    duration_days: 30 },
  { name: 'Moon Shot',        description: 'Be the first to hit +10% portfolio gains.',                   icon: '🚀', target_pct: 10,   duration_days: 90 },
  { name: 'Diamond Hands',    description: 'Reach +15% portfolio return.',                                icon: '💎', target_pct: 15,   duration_days: 60 },
  { name: 'Weekly Warrior',   description: 'Highest return % in 7 days wins. May the best trader win.',   icon: '⚡', target_pct: null, duration_days: 7  },
  { name: 'Monthly Champion', description: 'Best portfolio return over 30 days. Compete and dominate.',   icon: '🏆', target_pct: null, duration_days: 30 },
]

export function getDb(): Database.Database {
  if (_db) return _db
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  const version = _db.pragma('user_version', { simple: true }) as number

  // v1 → v2: drop single-user tables
  if (version < 2) {
    _db.exec(`
      DROP TABLE IF EXISTS account;
      DROP TABLE IF EXISTS positions;
      DROP TABLE IF EXISTS txns;
      DROP TABLE IF EXISTS snapshots;
    `)
  }

  // Create core tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS brackets (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      starting_cash REAL NOT NULL,
      emoji         TEXT NOT NULL,
      description   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
      bracket_id    TEXT NOT NULL,
      cash          REAL NOT NULL,
      starting_cash REAL,
      is_private    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (bracket_id) REFERENCES brackets(id)
    );

    CREATE TABLE IF NOT EXISTS positions (
      player_id INTEGER NOT NULL,
      ticker    TEXT NOT NULL,
      shares    REAL NOT NULL,
      avg_cost  REAL NOT NULL,
      PRIMARY KEY (player_id, ticker),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS txns (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  INTEGER NOT NULL,
      ticker     TEXT NOT NULL,
      type       TEXT NOT NULL,
      shares     REAL NOT NULL,
      price      REAL NOT NULL,
      total      REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL,
      total_value REAL NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL,
      icon          TEXT NOT NULL DEFAULT '🎯',
      target_pct    REAL,
      duration_days INTEGER NOT NULL DEFAULT 30,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS challenge_entries (
      challenge_id             INTEGER NOT NULL,
      player_id                INTEGER NOT NULL,
      starting_portfolio_value REAL NOT NULL,
      joined_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      PRIMARY KEY (challenge_id, player_id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id),
      FOREIGN KEY (player_id)    REFERENCES players(id)
    );
  `)

  // v2 → v3: add new player columns
  if (version < 3) {
    try { _db.exec('ALTER TABLE players ADD COLUMN starting_cash REAL') } catch { /* already exists */ }
    try { _db.exec('ALTER TABLE players ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
    // Back-fill starting_cash for existing players
    _db.exec(`
      UPDATE players SET starting_cash = (
        SELECT b.starting_cash FROM brackets b WHERE b.id = players.bracket_id
      ) WHERE starting_cash IS NULL
    `)
  }

  _db.pragma('user_version = 3')

  // Seed brackets
  const insBracket = _db.prepare(
    'INSERT OR IGNORE INTO brackets (id,name,starting_cash,emoji,description) VALUES (?,?,?,?,?)'
  )
  for (const b of BRACKETS) insBracket.run(b.id, b.name, b.starting_cash, b.emoji, b.description)

  // Seed default challenges (only if none exist)
  const challengeCount = (_db.prepare('SELECT COUNT(*) as n FROM challenges').get() as { n: number }).n
  if (challengeCount === 0) {
    const insChallenge = _db.prepare(
      'INSERT INTO challenges (name,description,icon,target_pct,duration_days) VALUES (?,?,?,?,?)'
    )
    for (const c of DEFAULT_CHALLENGES) insChallenge.run(c.name, c.description, c.icon, c.target_pct, c.duration_days)
  }

  return _db
}

export interface Player {
  id: number; name: string; bracket_id: string; cash: number
  starting_cash: number | null; is_private: number; created_at: string
}
export interface Position   { player_id: number; ticker: string; shares: number; avg_cost: number }
export interface Txn        { id: number; player_id: number; ticker: string; type: 'buy'|'sell'; shares: number; price: number; total: number; created_at: string }
export interface Snapshot   { total_value: number; created_at: string }
export interface Bracket    { id: string; name: string; starting_cash: number; emoji: string; description: string }
export interface Challenge  { id: number; name: string; description: string; icon: string; target_pct: number|null; duration_days: number; is_active: number; created_at: string }
