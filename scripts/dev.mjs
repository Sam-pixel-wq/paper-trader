#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const port = process.env.PORT || '3000'
const clean = process.argv.includes('--clean')

function killPort() {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim()
    if (!out) return
    for (const pid of out.split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
    console.log(`Freed port ${port}`)
  } catch {
    /* nothing listening */
  }
}

if (clean && existsSync(join(root, '.next'))) {
  rmSync(join(root, '.next'), { recursive: true, force: true })
  console.log('Removed .next cache')
}

killPort()

const child = spawn('npx', ['next', 'dev', '-p', port, '--hostname', '0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
})

child.on('exit', code => process.exit(code ?? 0))

process.on('SIGINT', () => {
  child.kill('SIGINT')
})
process.on('SIGTERM', () => {
  child.kill('SIGTERM')
})
