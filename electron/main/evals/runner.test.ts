import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { childEnv, createSpawnRunner } from './runner'

const made: string[] = []

const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'desafinado-runner-test-'))
  made.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('childEnv', () => {
  it('carries only HOME and PATH', () => {
    expect(childEnv({ home: '/home/u', path: '/bin' })).toEqual({
      HOME: '/home/u',
      PATH: '/bin',
    })
    expect(childEnv({ home: '/home/u', path: undefined })).toEqual({
      HOME: '/home/u',
    })
  })
})

describe('createSpawnRunner', () => {
  it('runs in the given folder with only HOME and PATH', async () => {
    const dir = scratch()
    const out = join(dir, 'env.json')
    const script = join(dir, 'probe.js')
    writeFileSync(
      script,
      `require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ env: Object.keys(process.env).sort(), cwd: process.cwd() }))`,
    )
    process.env.ANTHROPIC_API_KEY = 'leak-check'
    const runner = createSpawnRunner({ home: dir, path: process.env.PATH })
    const exit = await runner.run({
      executable: process.execPath,
      args: [script, out],
      cwd: dir,
    })
    delete process.env.ANTHROPIC_API_KEY
    const seen = JSON.parse(
      (await import('node:fs')).readFileSync(out, 'utf8'),
    ) as { env: string[]; cwd: string }
    expect(exit).toEqual({ exitCode: 0, signal: null })
    expect(seen.env.filter((name) => !name.startsWith('__'))).toEqual([
      'HOME',
      'PATH',
    ])
  })

  it('reports a failing exit code', async () => {
    const runner = createSpawnRunner({ home: tmpdir(), path: process.env.PATH })
    const exit = await runner.run({
      executable: process.execPath,
      args: ['-e', 'process.exit(1)'],
      cwd: tmpdir(),
    })
    expect(exit.exitCode).toBe(1)
  })

  it('rejects when the program cannot start', async () => {
    const runner = createSpawnRunner({ home: tmpdir(), path: undefined })
    await expect(
      runner.run({ executable: '/no/such/claude', args: [], cwd: tmpdir() }),
    ).rejects.toThrow()
  })

  it('kills the running child with SIGTERM', async () => {
    const runner = createSpawnRunner({ home: tmpdir(), path: process.env.PATH })
    const running = runner.run({
      executable: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      cwd: tmpdir(),
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(runner.kill()).toBe(true)
    expect(await running).toEqual({ exitCode: null, signal: 'SIGTERM' })
    expect(runner.kill()).toBe(false)
  })

  it('reads the version from --version output', async () => {
    const dir = scratch()
    const script = join(dir, 'claude')
    writeFileSync(script, '#!/bin/sh\necho "2.1.319 (Claude Code)"\n', {
      mode: 0o755,
    })
    const runner = createSpawnRunner({ home: dir, path: process.env.PATH })
    expect(await runner.version(script)).toBe('2.1.319')
  })

  it('returns null when there is no version', async () => {
    const runner = createSpawnRunner({ home: tmpdir(), path: undefined })
    expect(await runner.version('/no/such/claude')).toBeNull()
  })

  it('kills the whole process tree, even when SIGTERM is ignored', async () => {
    const dir = scratch()
    const pids = join(dir, 'pids')
    const script = `trap '' TERM; (sleep 300 & echo $! >> '${pids}'; wait) & echo $$ >> '${pids}'; wait`
    const runner = createSpawnRunner(
      { home: process.env.HOME ?? '/', path: process.env.PATH },
      { killAfterMs: 300 },
    )
    const exit = runner.run({
      executable: '/bin/sh',
      args: ['-c', script],
      cwd: dir,
    })
    const read = (): number[] => {
      try {
        return readFileSync(pids, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map(Number)
      } catch {
        return []
      }
    }
    await vi.waitFor(() => expect(read()).toHaveLength(2))
    const alive = (pid: number): boolean => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }
    expect(read().every(alive)).toBe(true)
    expect(runner.kill()).toBe(true)
    await exit
    await vi.waitFor(() => expect(read().some(alive)).toBe(false), {
      timeout: 3000,
    })
  })

  it('does not kill anything when nothing runs', () => {
    expect(createSpawnRunner({ home: '/', path: undefined }).kill()).toBe(false)
  })
})
