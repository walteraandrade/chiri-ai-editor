import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEvalHandlers, type EvalDeps } from './handlers'
import { createResultsStore, skillKeyOf } from './results'
import type { EvalExit, EvalJob, EvalRunner } from './runner'

const fixture = (name: string): string =>
  readFileSync(
    new URL(`../../../src/evals/fixtures/${name}`, import.meta.url),
    'utf8',
  )

const SKILL = '/skills/pdf'
const NONE = { kind: 'none' } as const
const REQUEST = {
  skillPath: SKILL,
  baseline: { kind: 'none' },
  runs: 2,
  model: 'haiku',
  maxCostUsd: 0.5,
}

const made: string[] = []

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

type Setup = {
  readonly userData: string
  readonly jobs: EvalJob[]
  readonly cleanup: ReturnType<typeof vi.fn>
  readonly openPath: ReturnType<typeof vi.fn>
  readonly deps: EvalDeps
}

type SetupOptions = {
  readonly report?: string | null
  readonly exitCode?: number | null
  readonly signal?: string | null
  readonly skillText?: string
  readonly executable?: string | null
  readonly skills?: readonly string[]
  readonly version?: string | null
}

const setup = ({
  report = fixture('with-without.json'),
  exitCode = 0,
  signal = null,
  skillText = '---\nname: pdf\n---\nBody\n',
  executable = '/bin/claude',
  skills = [SKILL],
  version = '2.1.319',
}: SetupOptions = {}): Setup => {
  const userData = mkdtempSync(join(tmpdir(), 'chiri-handlers-test-'))
  made.push(userData)
  const jobs: EvalJob[] = []
  const cleanup = vi.fn(async () => undefined)
  const openPath = vi.fn(async () => '')
  const results = createResultsStore(userData)
  const runner: EvalRunner = {
    version: async () => version,
    kill: () => false,
    run: async (job): Promise<EvalExit> => {
      jobs.push(job)
      const jsonFile = job.args[job.args.indexOf('--json') + 1] ?? ''
      const outputDir = job.args[job.args.indexOf('--output-dir') + 1] ?? ''
      if (report !== null) {
        writeFileSync(jsonFile, report)
        mkdirSync(outputDir, { recursive: true })
        writeFileSync(join(outputDir, 'report.html'), '<p>report</p>')
      }
      return { exitCode, signal }
    },
  }
  const deps: EvalDeps = {
    librarySkillPaths: async () => skills,
    realPath: async (path) => path,
    findClaude: async () => executable,
    runner,
    stage: async () => ({
      dir: '/stage/pdf',
      skillText,
      caseCount: 2,
      leftOut: [],
      cleanup,
    }),
    results,
    history: { versions: () => [], text: () => null },
    openPath,
  }
  return { userData, jobs, cleanup, openPath, deps }
}

describe('status', () => {
  it('says there is no CLI', async () => {
    const { deps } = setup({ executable: null })
    expect(await createEvalHandlers(deps).status({ skillPath: SKILL })).toEqual(
      { kind: 'no-cli' },
    )
  })

  it('reports the CLI version and no last run', async () => {
    const { deps } = setup()
    expect(await createEvalHandlers(deps).status({ skillPath: SKILL })).toEqual(
      {
        kind: 'ready',
        claudeVersion: '2.1.319',
        last: null,
        running: false,
        cancelling: false,
        runningSkill: null,
        stopped: null,
      },
    )
  })

  it('refuses a path that is not a Skill in the Library', async () => {
    const { deps } = setup({ skills: [] })
    expect(
      (await createEvalHandlers(deps).status({ skillPath: SKILL })).kind,
    ).toBe('failed')
  })

  it('refuses a malformed request', async () => {
    const { deps } = setup()
    expect((await createEvalHandlers(deps).status({})).kind).toBe('failed')
  })
})

describe('prepare', () => {
  it('stages, reads the risks and deletes the Stage', async () => {
    const { deps, cleanup } = setup({
      skillText: '---\nname: pdf\n---\n!`ls`\n',
    })
    const result = await createEvalHandlers(deps).prepare({
      skillPath: SKILL,
      baseline: NONE,
    })
    expect(result).toEqual({
      kind: 'ready',
      claudeVersion: '2.1.319',
      caseCount: 2,
      risks: [{ kind: 'shell-commands', lines: ['!`ls`'] }],
      baselineRisks: null,
      versions: [],
      sameAsSaved: [],
    })
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})

describe('run', () => {
  it('refuses a run that was not prepared', async () => {
    const { deps, jobs } = setup()
    expect(await createEvalHandlers(deps).run(REQUEST)).toEqual({
      kind: 'risks-changed',
    })
    expect(jobs).toEqual([])
  })

  it('refuses when the risks changed since prepare', async () => {
    const { deps, jobs } = setup()
    let skillText = 'plain\n'
    const handlers = createEvalHandlers({
      ...deps,
      stage: async () => ({
        dir: '/stage/pdf',
        skillText,
        caseCount: 2,
        leftOut: [],
        cleanup: async () => undefined,
      }),
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    skillText = '---\nhooks:\n  A: []\n---\n'
    expect(await handlers.run(REQUEST)).toEqual({ kind: 'risks-changed' })
    expect(jobs).toEqual([])
  })

  it('runs the fixed command in the Stage and keeps a complete run', async () => {
    const { deps, jobs, userData, cleanup } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const result = await handlers.run(REQUEST)
    expect(result.kind).toBe('completed')
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    const key = skillKeyOf(SKILL)
    expect(job?.executable).toBe('/bin/claude')
    expect(job?.cwd).toBe('/stage/pdf')
    expect(job?.args).toEqual([
      'plugin',
      'eval',
      '.',
      '--trust-plugin',
      '--no-publish',
      '--threshold',
      '0',
      '--max-cost-usd',
      '0.5',
      '--runs',
      '2',
      '--model=haiku',
      '--json',
      join(userData, 'eval-runs', key, 'next', 'result.json'),
      '--output-dir',
      join(userData, 'eval-runs', key, 'next', 'report'),
    ])
    expect(
      existsSync(join(userData, 'eval-runs', key, 'last', 'result.json')),
    ).toBe(true)
    expect(existsSync(join(userData, 'eval-runs', key, 'next'))).toBe(false)
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(
      (await handlers.status({ skillPath: SKILL })).kind === 'ready' &&
        (await handlers.status({ skillPath: SKILL })),
    ).toMatchObject({ last: { with: { passed: 1, total: 1 } } })
  })

  it.each([
    ['a partial report', fixture('auth-failed.json'), 1],
    ['an unreadable report', '{nope', 0],
    ['another schemaVersion', JSON.stringify({ schemaVersion: 9 }), 0],
    ['no report at all', null, 1],
    ['exit 2 with a complete report', fixture('with-without.json'), 2],
  ])('keeps the last run when %s', async (_name, report, exitCode) => {
    const { deps, userData } = setup({ report, exitCode })
    const handlers = createEvalHandlers(deps)
    const key = skillKeyOf(SKILL)
    const last = join(userData, 'eval-runs', key, 'last')
    mkdirSync(last, { recursive: true })
    writeFileSync(join(last, 'result.json'), fixture('with-without.json'))
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const result = await handlers.run(REQUEST)
    expect(result.kind).toBe('not-complete')
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe(
      fixture('with-without.json'),
    )
    expect(existsSync(join(userData, 'eval-runs', key, 'next'))).toBe(false)
  })

  it('keeps the last run when cases is empty', async () => {
    const empty = JSON.parse(fixture('with-without.json'))
    empty.cases = []
    const { deps, userData } = setup({
      report: JSON.stringify(empty),
      exitCode: 1,
    })
    const handlers = createEvalHandlers(deps)
    const key = skillKeyOf(SKILL)
    const last = join(userData, 'eval-runs', key, 'last')
    mkdirSync(last, { recursive: true })
    writeFileSync(join(last, 'result.json'), 'previous')
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect(await handlers.run(REQUEST)).toEqual({
      kind: 'not-complete',
      message: 'No Evals in this skill',
      costUsd: expect.any(Number),
    })
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe('previous')
    expect(existsSync(join(userData, 'eval-runs', key, 'next'))).toBe(false)
  })

  it('needs a fresh prepare for every run', async () => {
    const { deps, jobs } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect((await handlers.run(REQUEST)).kind).toBe('completed')
    expect(await handlers.run(REQUEST)).toEqual({ kind: 'risks-changed' })
    expect(jobs).toHaveLength(1)
  })

  it('kills the child on shutdown and cleans up once it exits', async () => {
    const { deps, cleanup, userData } = setup()
    let release: (exit: EvalExit) => void = () => undefined
    let started = false
    const kill = vi.fn(() => {
      release({ exitCode: null, signal: 'SIGTERM' })
      return true
    })
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill,
        run: () =>
          new Promise<EvalExit>((resolve) => {
            started = true
            release = resolve
          }),
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    cleanup.mockClear()
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    expect(handlers.isRunning()).toBe(true)
    await handlers.shutdown()
    expect(kill).toHaveBeenCalledTimes(1)
    expect((await running).kind).toBe('not-complete')
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(
      existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
    ).toBe(false)
    expect(handlers.isRunning()).toBe(false)
  })

  it('does not kill anything on shutdown when idle', async () => {
    const { deps } = setup()
    const kill = vi.spyOn(deps.runner, 'kill')
    await createEvalHandlers(deps).shutdown()
    expect(kill).not.toHaveBeenCalled()
  })

  it('names the CLI version when the schema is not supported', async () => {
    const { deps } = setup({
      report: JSON.stringify({ schemaVersion: 9, claudeVersion: '9.9.9' }),
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const result = await handlers.run(REQUEST)
    expect(result.kind === 'not-complete' && result.message).toContain('9.9.9')
  })

  it('accepts exit 1 when the report is complete', async () => {
    const { deps } = setup({ exitCode: 1 })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect((await handlers.run(REQUEST)).kind).toBe('completed')
  })

  it('deletes the Stage when the runner throws', async () => {
    const { deps, cleanup } = setup()
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill: () => false,
        run: async () => {
          throw new Error('spawn failed')
        },
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    cleanup.mockClear()
    expect((await handlers.run(REQUEST)).kind).toBe('failed')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('runs one at a time', async () => {
    const { deps } = setup()
    let release: (exit: EvalExit) => void = () => undefined
    let started = false
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill: () => false,
        run: () =>
          started
            ? Promise.resolve({ exitCode: 1, signal: null })
            : new Promise<EvalExit>((resolve) => {
                started = true
                release = resolve
              }),
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const first = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    expect(await handlers.run(REQUEST)).toEqual({ kind: 'busy' })
    release({ exitCode: 1, signal: null })
    await first
    expect((await handlers.run(REQUEST)).kind).not.toBe('busy')
  })

  it('refuses a request outside the Library or with bad values', async () => {
    const { deps, jobs } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect(
      (await handlers.run({ ...REQUEST, model: '--allow-tools' })).kind,
    ).toBe('failed')
    expect(
      (await handlers.run({ ...REQUEST, skillPath: '/elsewhere' })).kind,
    ).toBe('failed')
    expect(jobs).toEqual([])
  })

  it('says there is no CLI', async () => {
    const { deps } = setup({ executable: null })
    expect(await createEvalHandlers(deps).run(REQUEST)).toEqual({
      kind: 'no-cli',
    })
  })
})

describe('cancel', () => {
  const cancelledReport = (reason: string | null): string =>
    JSON.stringify({
      ...JSON.parse(fixture('auth-failed.json')),
      partial: true,
      partialReason: reason,
    })

  const deferred = <T>() => {
    let resolve: (value: T) => void = () => undefined
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  const keepLast = (userData: string): string => {
    const last = join(userData, 'eval-runs', skillKeyOf(SKILL), 'last')
    mkdirSync(last, { recursive: true })
    writeFileSync(join(last, 'result.json'), 'previous')
    return last
  }

  it('does nothing when no run is going', async () => {
    const { deps } = setup()
    const kill = vi.spyOn(deps.runner, 'kill')
    expect(await createEvalHandlers(deps).cancel(undefined)).toEqual({
      kind: 'idle',
    })
    expect(kill).not.toHaveBeenCalled()
  })

  it('refuses a request with fields', async () => {
    const { deps } = setup()
    expect(
      (await createEvalHandlers(deps).cancel({ skillPath: SKILL })).kind,
    ).toBe('failed')
  })

  it('kills the child, says Cancelled and keeps the last run', async () => {
    const { deps, cleanup, userData } = setup()
    const exit = deferred<EvalExit>()
    let started = false
    const kill = vi.fn(() => {
      exit.resolve({ exitCode: 143, signal: null })
      return true
    })
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill,
        run: () => {
          started = true
          return exit.promise
        },
      },
    })
    const last = keepLast(userData)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    cleanup.mockClear()
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    expect(await handlers.cancel(undefined)).toEqual({ kind: 'cancelling' })
    expect(kill).toHaveBeenCalledTimes(1)
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe('previous')
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(
      existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
    ).toBe(false)
    expect(handlers.isRunning()).toBe(false)
  })

  it('never turns a cancelled run into a pass, even with a complete report', async () => {
    const { deps, userData } = setup()
    const exit = deferred<EvalExit>()
    let started = false
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill: () => {
          exit.resolve({ exitCode: 0, signal: null })
          return true
        },
        run: async (job) => {
          started = true
          const jsonFile = job.args[job.args.indexOf('--json') + 1] ?? ''
          writeFileSync(jsonFile, fixture('with-without.json'))
          return exit.promise
        },
      },
    })
    const last = keepLast(userData)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    await handlers.cancel(undefined)
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: 0.00265497,
    })
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe('previous')
  })

  it('says Cancelled for an interrupted partial report and keeps the last run', async () => {
    const { deps, userData } = setup({
      report: cancelledReport('interrupted'),
      exitCode: 130,
    })
    const handlers = createEvalHandlers(deps)
    const last = keepLast(userData)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect(await handlers.run(REQUEST)).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: 0,
    })
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe('previous')
  })

  it.each([
    ['cost_ceiling', 'Stopped at the cost limit (US$0.50)'],
    ['auth_failed', 'Claude is not logged in'],
  ])('maps %s and keeps the last run', async (reason, message) => {
    const { deps, userData } = setup({
      report: cancelledReport(reason),
      exitCode: 2,
    })
    const handlers = createEvalHandlers(deps)
    const last = keepLast(userData)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect(await handlers.run(REQUEST)).toEqual({
      kind: 'not-complete',
      message,
      costUsd: 0,
    })
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe('previous')
    expect(
      existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
    ).toBe(false)
  })

  const gated = (gate: 'stage' | 'begin') => {
    const { deps, cleanup, userData } = setup()
    const open = deferred<void>()
    const entered = deferred<void>()
    const run = vi.fn(
      async (): Promise<EvalExit> => ({
        exitCode: 0,
        signal: null,
      }),
    )
    const kill = vi.fn(() => false)
    const armed = { on: false }
    const handlers = createEvalHandlers({
      ...deps,
      runner: { version: async () => '2.1.319', kill, run },
      stage: async (path) => {
        const stage = await deps.stage(path)
        if (gate === 'stage' && armed.on) {
          entered.resolve()
          await open.promise
        }
        return stage
      },
      results: {
        ...deps.results,
        begin: async (key) => {
          const next = await deps.results.begin(key)
          if (gate === 'begin' && armed.on) {
            entered.resolve()
            await open.promise
          }
          return next
        },
      },
    })
    return { handlers, cleanup, userData, open, entered, run, kill, armed }
  }

  it.each(['stage', 'begin'] as const)(
    'stops a run cancelled during %s before it spawns, and deletes the Stage and next/',
    async (gate) => {
      const { handlers, cleanup, userData, open, entered, run, armed } =
        gated(gate)
      await handlers.prepare({ skillPath: SKILL, baseline: NONE })
      armed.on = true
      cleanup.mockClear()
      const running = handlers.run(REQUEST)
      await entered.promise
      expect(await handlers.cancel(undefined)).toEqual({ kind: 'cancelling' })
      open.resolve()
      expect(await running).toEqual({
        kind: 'not-complete',
        message: 'Cancelled',
        costUsd: null,
      })
      expect(run).not.toHaveBeenCalled()
      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(
        existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
      ).toBe(false)
      expect(handlers.isRunning()).toBe(false)
    },
  )

  it('stops a run cancelled while looking for the CLI', async () => {
    const { deps, jobs } = setup()
    const open = deferred<string | null>()
    const entered = deferred<void>()
    let calls = 0
    const handlers = createEvalHandlers({
      ...deps,
      findClaude: async () => {
        calls += 1
        if (calls === 1) return deps.findClaude()
        entered.resolve()
        return open.promise
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await entered.promise
    await handlers.cancel(undefined)
    open.resolve('/bin/claude')
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
    expect(jobs).toEqual([])
  })

  it('shutdown before the spawn stops the run and deletes the Stage and next/', async () => {
    const { handlers, cleanup, userData, open, entered, run, armed } =
      gated('begin')
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    armed.on = true
    cleanup.mockClear()
    const running = handlers.run(REQUEST)
    await entered.promise
    const shutting = handlers.shutdown()
    open.resolve()
    await shutting
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
    expect(run).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(
      existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
    ).toBe(false)
  })

  it('does not carry a cancel into the next run', async () => {
    const { deps } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect((await handlers.run(REQUEST)).kind).toBe('completed')
    await handlers.cancel(undefined)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    expect((await handlers.run(REQUEST)).kind).toBe('completed')
  })
})

describe('after a run', () => {
  const deferred = <T>() => {
    let resolve: (value: T) => void = () => undefined
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it('names the CLI version when the report is not JSON', async () => {
    const { deps } = setup({ report: 'not json' })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const result = await handlers.run(REQUEST)
    expect(result.kind === 'not-complete' && result.message).toBe(
      'The Eval report could not be read (Claude CLI 2.1.319)',
    )
  })

  it('says No Evals in this skill for exit 0 too', async () => {
    const empty = { ...JSON.parse(fixture('with-without.json')), cases: [] }
    const { deps } = setup({ report: JSON.stringify(empty), exitCode: 0 })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const result = await handlers.run(REQUEST)
    expect(result.kind === 'not-complete' && result.message).toBe(
      'No Evals in this skill',
    )
  })

  it('shows running and cancelling in status, per skill', async () => {
    const { deps } = setup()
    const exit = deferred<EvalExit>()
    let started = false
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill: () => {
          exit.resolve({ exitCode: 143, signal: null })
          return true
        },
        run: () => {
          started = true
          return exit.promise
        },
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      running: true,
      cancelling: false,
    })
    await handlers.cancel(undefined)
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      running: true,
      cancelling: true,
    })
    await running
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      running: false,
      cancelling: false,
    })
  })

  it('names the running Skill in the status of another Skill', async () => {
    const { deps } = setup({ skills: [SKILL, '/skills/docx'] })
    const exit = deferred<EvalExit>()
    let started = false
    const handlers = createEvalHandlers({
      ...deps,
      runner: {
        version: async () => '2.1.319',
        kill: () => {
          exit.resolve({ exitCode: 143, signal: null })
          return true
        },
        run: () => {
          started = true
          return exit.promise
        },
      },
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(true))
    expect(await handlers.status({ skillPath: '/skills/docx' })).toMatchObject({
      running: false,
      runningSkill: basename(SKILL),
    })
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      running: true,
      runningSkill: basename(SKILL),
    })
    await handlers.cancel(undefined)
    await running
    expect(await handlers.status({ skillPath: '/skills/docx' })).toMatchObject({
      runningSkill: null,
    })
  })

  it('keeps the last stopped outcome in memory until the next run completes', async () => {
    const { deps } = setup({
      report: JSON.stringify({
        ...JSON.parse(fixture('auth-failed.json')),
        costUsd: 0.0015,
      }),
      exitCode: 2,
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    await handlers.run(REQUEST)
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      stopped: { message: 'Claude is not logged in', costUsd: 0.0015 },
    })
  })

  it('clears the stopped outcome when a run completes', async () => {
    const { deps } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    await handlers.run({ ...REQUEST, skillPath: '/skills/pdf' })
    expect(await handlers.status({ skillPath: SKILL })).toMatchObject({
      stopped: null,
    })
  })

  it('never ends completed when a cancel was answered before the report was read', async () => {
    const { deps, userData } = setup()
    const read = deferred<void>()
    const reading = deferred<void>()
    const results = {
      ...deps.results,
      readNext: async (key: string) => {
        reading.resolve()
        await read.promise
        return deps.results.readNext(key)
      },
    }
    const handlers = createEvalHandlers({ ...deps, results })
    const last = join(userData, 'eval-runs', skillKeyOf(SKILL), 'last')
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await reading.promise
    expect(await handlers.cancel(undefined)).toEqual({ kind: 'cancelling' })
    read.resolve()
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: expect.any(Number),
    })
    expect(existsSync(last)).toBe(false)
  })

  it('shutdown while committing waits for promote to finish', async () => {
    const { deps, userData } = setup()
    const promoting = deferred<void>()
    const hold = deferred<void>()
    const kill = vi.spyOn(deps.runner, 'kill')
    const results = {
      ...deps.results,
      promote: async (key: string) => {
        promoting.resolve()
        await hold.promise
        return deps.results.promote(key)
      },
    }
    const handlers = createEvalHandlers({ ...deps, results })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await promoting.promise
    let shutDown = false
    const shutting = handlers.shutdown().then(() => {
      shutDown = true
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(shutDown).toBe(false)
    expect(kill).not.toHaveBeenCalled()
    hold.resolve()
    await shutting
    expect((await running).kind).toBe('completed')
    expect(
      existsSync(
        join(userData, 'eval-runs', skillKeyOf(SKILL), 'last', 'result.json'),
      ),
    ).toBe(true)
  })

  it('answers idle for a cancel once the run is being promoted', async () => {
    const { deps } = setup()
    const promoting = deferred<void>()
    const hold = deferred<void>()
    const results = {
      ...deps.results,
      promote: async (key: string) => {
        promoting.resolve()
        await hold.promise
        return deps.results.promote(key)
      },
    }
    const handlers = createEvalHandlers({ ...deps, results })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    const running = handlers.run(REQUEST)
    await promoting.promise
    expect(await handlers.cancel(undefined)).toEqual({ kind: 'idle' })
    hold.resolve()
    expect((await running).kind).toBe('completed')
  })

  it('says Cancelled when cancelled before a library or CLI check fails', async () => {
    const gate = deferred<string | null>()
    const entered = deferred<void>()
    const { deps } = setup()
    const handlers = createEvalHandlers({
      ...deps,
      findClaude: async () => {
        entered.resolve()
        return gate.promise
      },
    })
    const running = handlers.run(REQUEST)
    await entered.promise
    await handlers.cancel(undefined)
    gate.resolve(null)
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
  })

  it('says Cancelled when cancelled during stage, before risks-changed', async () => {
    const gate = deferred<void>()
    const entered = deferred<void>()
    const { deps } = setup()
    const handlers = createEvalHandlers({
      ...deps,
      stage: async (path) => {
        const stage = await deps.stage(path)
        entered.resolve()
        await gate.promise
        return stage
      },
    })
    const running = handlers.run(REQUEST)
    await entered.promise
    await handlers.cancel(undefined)
    gate.resolve()
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
  })
})

describe('openReport', () => {
  it('opens the report of the last complete run', async () => {
    const { deps, openPath, userData } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    await handlers.run(REQUEST)
    expect(await handlers.openReport({ skillPath: SKILL })).toEqual({
      kind: 'opened',
    })
    expect(openPath).toHaveBeenCalledWith(
      join(
        userData,
        'eval-runs',
        skillKeyOf(SKILL),
        'last',
        'report',
        'report.html',
      ),
    )
  })

  it('fails when there is no report', async () => {
    const { deps, openPath } = setup()
    expect(
      (await createEvalHandlers(deps).openReport({ skillPath: SKILL })).kind,
    ).toBe('failed')
    expect(openPath).not.toHaveBeenCalled()
  })

  it('fails when the system cannot open it', async () => {
    const { deps } = setup()
    const handlers = createEvalHandlers({
      ...deps,
      openPath: async () => 'no handler',
    })
    await handlers.prepare({ skillPath: SKILL, baseline: NONE })
    await handlers.run(REQUEST)
    expect((await handlers.openReport({ skillPath: SKILL })).kind).toBe(
      'failed',
    )
  })
})
