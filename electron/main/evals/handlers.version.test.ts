import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VersionSummary } from '../../../src/history/types'
import { createEvalHandlers, type EvalDeps } from './handlers'
import { createResultsStore, skillKeyOf } from './results'
import type { EvalExit, EvalJob } from './runner'

const fixture = (name: string): string =>
  readFileSync(
    new URL(`../../../src/evals/fixtures/${name}`, import.meta.url),
    'utf8',
  )

const SKILL = '/skills/pdf'
const FILE = '/skills/pdf/SKILL.md'
const OLDER = '---\nname: pdf\n---\nOlder\n'
const TODAY = '---\nname: pdf\n---\nToday\n'

const version = (id: number, at: number): VersionSummary => ({
  id,
  at,
  cause: { kind: 'edited' },
  words: 3,
  wordsAdded: 1,
  wordsRemoved: 0,
})

const REQUEST = {
  skillPath: SKILL,
  baseline: { kind: 'version', versionId: 7 },
  runs: 2,
  model: 'haiku',
  maxCostUsd: 0.5,
} as const

const PREPARE = { skillPath: SKILL, baseline: REQUEST.baseline }

type Report = Record<string, unknown> & {
  costUsd: number
  cases: { name: string; arms: Record<string, unknown> }[]
}

const withArmOnly = (
  edit: (report: Report) => void = () => undefined,
): string => {
  const report = JSON.parse(fixture('with-without.json')) as Report
  for (const item of report.cases) delete item.arms.without
  edit(report)
  return JSON.stringify(report)
}

const made: string[] = []

afterEach(() => {
  for (const dir of made.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

type Setup = {
  readonly userData: string
  readonly jobs: EvalJob[]
  readonly cleaned: string[]
  readonly stagedTexts: (string | undefined)[]
  readonly deps: EvalDeps
}

type SetupOptions = {
  readonly reports?: readonly (string | null)[]
  readonly exits?: readonly EvalExit[]
  readonly onRun?: (index: number) => void
  readonly olderText?: string | null
  readonly versions?: readonly VersionSummary[]
}

const setup = ({
  reports = [withArmOnly(), withArmOnly()],
  exits = [],
  onRun,
  olderText = OLDER,
  versions = [version(7, 1000), version(8, 2000)],
}: SetupOptions = {}): Setup => {
  const userData = mkdtempSync(join(tmpdir(), 'chiri-version-test-'))
  made.push(userData)
  const jobs: EvalJob[] = []
  const cleaned: string[] = []
  const stagedTexts: (string | undefined)[] = []
  const deps: EvalDeps = {
    librarySkillPaths: async () => [SKILL],
    realPath: async (path) => path,
    findClaude: async () => '/bin/claude',
    runner: {
      version: async () => '2.1.319',
      kill: () => false,
      run: async (job) => {
        const index = jobs.length
        jobs.push(job)
        onRun?.(index)
        const report = reports[index] ?? null
        const jsonFile = job.args[job.args.indexOf('--json') + 1] ?? ''
        const outputDir = job.args[job.args.indexOf('--output-dir') + 1] ?? ''
        if (report !== null) {
          writeFileSync(jsonFile, report)
          mkdirSync(outputDir, { recursive: true })
          writeFileSync(join(outputDir, 'report.html'), `<p>${index}</p>`)
        }
        return exits[index] ?? { exitCode: 0, signal: null }
      },
    },
    stage: async (_path, skillText) => {
      stagedTexts.push(skillText)
      const name = skillText === undefined ? '/stage/today' : '/stage/older'
      return {
        dir: name,
        skillText: skillText ?? TODAY,
        caseCount: 1,
        leftOut: [],
        cleanup: async () => {
          cleaned.push(name)
        },
      }
    },
    results: createResultsStore(userData),
    history: {
      versions: (path) => (path === FILE ? versions : []),
      text: (path, id) => (path === FILE && id === 7 ? olderText : null),
    },
    countEvals: async () => 2,
    openPath: async () => '',
  }
  return { userData, jobs, cleaned, stagedTexts, deps }
}

const argAfter = (job: EvalJob | undefined, flag: string): string =>
  job?.args[(job?.args.indexOf(flag) ?? -1) + 1] ?? ''

describe('prepare with a Version baseline', () => {
  it("stages both, reads the Version's text from History and lists the Versions", async () => {
    const { deps, cleaned, stagedTexts } = setup()
    const result = await createEvalHandlers(deps).prepare(PREPARE)
    expect(result).toMatchObject({
      kind: 'ready',
      caseCount: 1,
      risks: [],
      baselineRisks: [],
      versions: [version(7, 1000), version(8, 2000)],
    })
    expect(stagedTexts).toEqual([undefined, OLDER])
    expect(cleaned.toSorted()).toEqual(['/stage/older', '/stage/today'])
  })

  it('shows the risks of the older Stage on their own', async () => {
    const { deps } = setup({ olderText: '---\nhooks: x\n---\n!`ls`\n' })
    const result = await createEvalHandlers(deps).prepare(PREPARE)
    expect(result).toMatchObject({
      risks: [],
      baselineRisks: [
        { kind: 'hooks-frontmatter' },
        { kind: 'shell-commands' },
      ],
    })
  })

  it('lists the Versions and no baseline risks when the baseline is none', async () => {
    const { deps, stagedTexts } = setup()
    const result = await createEvalHandlers(deps).prepare({
      skillPath: SKILL,
      baseline: { kind: 'none' },
    })
    expect(result).toMatchObject({
      baselineRisks: null,
      versions: [version(7, 1000), version(8, 2000)],
    })
    expect(stagedTexts).toEqual([undefined])
  })

  it("refuses a Version id that is not in this Skill's History", async () => {
    const { deps, cleaned } = setup()
    const result = await createEvalHandlers(deps).prepare({
      skillPath: SKILL,
      baseline: { kind: 'version', versionId: 99 },
    })
    expect(result).toEqual({
      kind: 'failed',
      reason: "That Version is not in this Skill's History",
    })
    expect(cleaned).toEqual([])
  })

  it('refuses a Version whose text History cannot give', async () => {
    const { deps } = setup({ olderText: null })
    expect((await createEvalHandlers(deps).prepare(PREPARE)).kind).toBe(
      'failed',
    )
  })

  it("asks History about this Skill's SKILL.md only, so another file's Version is refused", async () => {
    const { deps } = setup()
    const asked: string[] = []
    const handlers = createEvalHandlers({
      ...deps,
      history: {
        versions: (path) => {
          asked.push(path)
          return path === FILE ? [version(7, 1)] : []
        },
        text: (path, id) => (path === FILE && id === 7 ? OLDER : null),
      },
    })
    expect((await handlers.prepare(PREPARE)).kind).toBe('ready')
    expect(new Set(asked)).toEqual(new Set([FILE]))
  })
})

describe('run against a Version', () => {
  it('runs today then the Version, sequentially, with the #87 command plus --ablation none', async () => {
    const { deps, jobs, userData, cleaned } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result.kind).toBe('completed')
    const key = skillKeyOf(SKILL)
    const next = join(userData, 'eval-runs', key, 'next')
    expect(jobs.map((job) => job.cwd)).toEqual(['/stage/today', '/stage/older'])
    expect(jobs[0]?.args).toEqual([
      'plugin',
      'eval',
      '.',
      '--trust-plugin',
      '--no-publish',
      '--threshold',
      '0',
      '--max-cost-usd',
      '0.25',
      '--runs',
      '2',
      '--model=haiku',
      '--json',
      join(next, 'today', 'result.json'),
      '--output-dir',
      join(next, 'today', 'report'),
      '--ablation',
      'none',
    ])
    expect(argAfter(jobs[1], '--json')).toBe(
      join(next, 'version', 'result.json'),
    )
    expect(argAfter(jobs[1], '--ablation')).toBe('none')
    expect(cleaned.toSorted()).toEqual([
      '/stage/older',
      '/stage/older',
      '/stage/today',
      '/stage/today',
    ])
    expect(existsSync(next)).toBe(false)
  })

  it('splits the cost limit: half for the first run, what is left for the second', async () => {
    const { deps, jobs } = setup({
      reports: [
        withArmOnly((report) => {
          report.costUsd = 0.1
        }),
        withArmOnly(),
      ],
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    await handlers.run(REQUEST)
    expect(argAfter(jobs[0], '--max-cost-usd')).toBe('0.25')
    expect(argAfter(jobs[1], '--max-cost-usd')).toBe('0.4')
  })

  it('keeps a complete pair as last/, with the baseline, and shows it in status', async () => {
    const { deps, userData } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    await handlers.run(REQUEST)
    const last = join(userData, 'eval-runs', skillKeyOf(SKILL), 'last')
    expect(
      JSON.parse(readFileSync(join(last, 'baseline.json'), 'utf8')),
    ).toEqual({ kind: 'version', versionId: 7, at: 1000 })
    expect(existsSync(join(last, 'today', 'result.json'))).toBe(true)
    expect(existsSync(join(last, 'version', 'result.json'))).toBe(true)
    const status = await handlers.status({ skillPath: SKILL })
    expect(status).toMatchObject({
      kind: 'ready',
      last: { baseline: { kind: 'version', versionId: 7, at: 1000 } },
    })
  })

  it('compares the two reports Arm against Arm', async () => {
    const failing = withArmOnly((report) => {
      for (const item of report.cases)
        for (const entry of item.arms.with as { passed: boolean }[])
          entry.passed = false
    })
    const { deps } = setup({ reports: [withArmOnly(), failing] })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result).toMatchObject({
      kind: 'completed',
      summary: {
        with: { passed: 1, total: 1 },
        without: { passed: 0, total: 1 },
      },
    })
  })

  it("opens the report of today's side", async () => {
    const { deps } = setup()
    const openPath = vi.fn(async (_file: string) => '')
    const handlers = createEvalHandlers({ ...deps, openPath })
    await handlers.prepare(PREPARE)
    await handlers.run(REQUEST)
    await handlers.openReport({ skillPath: SKILL })
    expect(openPath).toHaveBeenCalledWith(
      expect.stringContaining(join('last', 'today', 'report', 'report.html')),
    )
  })

  it('does not start the second run when the first is not complete, and keeps last/', async () => {
    const { deps, jobs, userData, cleaned } = setup({
      reports: [fixture('auth-failed.json'), withArmOnly()],
    })
    const key = skillKeyOf(SKILL)
    const last = join(userData, 'eval-runs', key, 'last')
    mkdirSync(last, { recursive: true })
    writeFileSync(join(last, 'result.json'), fixture('with-without.json'))
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result).toMatchObject({
      kind: 'not-complete',
      message: 'Claude is not logged in',
    })
    expect(jobs).toHaveLength(1)
    expect(readFileSync(join(last, 'result.json'), 'utf8')).toBe(
      fixture('with-without.json'),
    )
    expect(existsSync(join(userData, 'eval-runs', key, 'next'))).toBe(false)
    expect(cleaned).toHaveLength(4)
  })

  it('is not complete when the second run is partial, adds both costs and keeps last/', async () => {
    const partial = JSON.parse(fixture('auth-failed.json')) as Report
    partial.costUsd = 0.02
    partial.partialReason = 'cost_ceiling'
    const { deps, userData } = setup({
      reports: [
        withArmOnly((report) => {
          report.costUsd = 0.05
        }),
        JSON.stringify(partial),
      ],
      exits: [
        { exitCode: 0, signal: null },
        { exitCode: 2, signal: null },
      ],
    })
    const key = skillKeyOf(SKILL)
    const last = join(userData, 'eval-runs', key, 'last')
    mkdirSync(last, { recursive: true })
    writeFileSync(join(last, 'result.json'), fixture('with-without.json'))
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result).toMatchObject({
      kind: 'not-complete',
      message: 'Stopped at the cost limit (US$0.50, what the first side left)',
    })
    expect(result.kind === 'not-complete' ? result.costUsd : 0).toBeCloseTo(
      0.07,
    )
    expect(existsSync(join(last, 'result.json'))).toBe(true)
    expect(existsSync(join(last, 'baseline.json'))).toBe(false)
  })

  it('does not start the second run when the first used the whole limit', async () => {
    const { deps, jobs } = setup({
      reports: [
        withArmOnly((report) => {
          report.costUsd = 0.5
        }),
        withArmOnly(),
      ],
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result).toEqual({
      kind: 'not-complete',
      message:
        'Stopped at the cost limit (US$0.50, nothing left for the second side)',
      costUsd: 0.5,
    })
    expect(jobs).toHaveLength(1)
  })

  it('refuses when the Version changed in History since prepare', async () => {
    const { deps, jobs } = setup()
    let text = OLDER
    const handlers = createEvalHandlers({
      ...deps,
      history: {
        versions: () => [version(7, 1000)],
        text: () => text,
      },
    })
    await handlers.prepare(PREPARE)
    text = '---\nhooks: x\n---\nOlder\n'
    expect(await handlers.run(REQUEST)).toEqual({ kind: 'risks-changed' })
    expect(jobs).toEqual([])
  })

  it('refuses a run prepared for another baseline', async () => {
    const { deps, jobs } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare({ skillPath: SKILL, baseline: { kind: 'none' } })
    expect(await handlers.run(REQUEST)).toEqual({ kind: 'risks-changed' })
    expect(jobs).toEqual([])
  })

  it('fails without running when the Version is gone', async () => {
    const { deps, jobs } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run({
      ...REQUEST,
      baseline: { kind: 'version', versionId: 99 },
    })
    expect(result.kind).toBe('failed')
    expect(jobs).toEqual([])
  })
})

describe('cancelling a run against a Version', () => {
  it('stops the active run, never starts the second and deletes both Stages and next/', async () => {
    const { deps, userData, cleaned } = setup()
    let release: (exit: EvalExit) => void = () => undefined
    let started = 0
    const runner = {
      version: async () => '2.1.319',
      kill: vi.fn(() => {
        release({ exitCode: 143, signal: null })
        return true
      }),
      run: (job: EvalJob) => {
        started += 1
        const jsonFile = job.args[job.args.indexOf('--json') + 1] ?? ''
        mkdirSync(join(jsonFile, '..'), { recursive: true })
        return new Promise<EvalExit>((resolve) => {
          release = resolve
        })
      },
    }
    const handlers = createEvalHandlers({ ...deps, runner })
    await handlers.prepare(PREPARE)
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(1))
    expect(await handlers.cancel(undefined)).toEqual({ kind: 'cancelling' })
    expect(await running).toEqual({
      kind: 'not-complete',
      message: 'Cancelled',
      costUsd: null,
    })
    expect(started).toBe(1)
    expect(cleaned.toSorted()).toEqual([
      '/stage/older',
      '/stage/older',
      '/stage/today',
      '/stage/today',
    ])
    expect(
      existsSync(join(userData, 'eval-runs', skillKeyOf(SKILL), 'next')),
    ).toBe(false)
  })

  it("stops the second run too, with the first run's cost counted", async () => {
    const { deps, cleaned } = setup()
    let release: (exit: EvalExit) => void = () => undefined
    let started = 0
    const runner = {
      version: async () => '2.1.319',
      kill: vi.fn(() => {
        release({ exitCode: 143, signal: null })
        return true
      }),
      run: (job: EvalJob) => {
        started += 1
        const jsonFile = job.args[job.args.indexOf('--json') + 1] ?? ''
        if (started === 1) {
          writeFileSync(jsonFile, withArmOnly())
          return Promise.resolve<EvalExit>({ exitCode: 0, signal: null })
        }
        return new Promise<EvalExit>((resolve) => {
          release = resolve
        })
      },
    }
    const handlers = createEvalHandlers({ ...deps, runner })
    await handlers.prepare(PREPARE)
    const running = handlers.run(REQUEST)
    await vi.waitFor(() => expect(started).toBe(2))
    await handlers.cancel(undefined)
    const result = await running
    expect(result).toMatchObject({ kind: 'not-complete', message: 'Cancelled' })
    expect(result.kind === 'not-complete' ? result.costUsd : null).toBeCloseTo(
      0.00265497,
    )
    expect(cleaned).toHaveLength(4)
  })

  it('does not run the second when the cancel lands between the two runs', async () => {
    let handlers: ReturnType<typeof createEvalHandlers> | null = null
    const { deps, jobs } = setup({
      onRun: (index) => {
        if (index === 0) void handlers?.cancel(undefined)
      },
    })
    handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run(REQUEST)
    expect(result).toMatchObject({ kind: 'not-complete', message: 'Cancelled' })
    expect(jobs).toHaveLength(1)
  })
})

describe('cost limit messages and floor', () => {
  it("says the first side stopped at its half and keeps the user's limit visible", async () => {
    const stopped = JSON.parse(fixture('auth-failed.json')) as Report
    stopped.partialReason = 'cost_ceiling'
    const { deps, jobs } = setup({
      reports: [JSON.stringify(stopped), withArmOnly()],
      exits: [{ exitCode: 2, signal: null }],
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    const result = await handlers.run({ ...REQUEST, maxCostUsd: 1 })
    expect(result).toMatchObject({
      kind: 'not-complete',
      message: 'Stopped at the cost limit (US$1.00, half for each side)',
    })
    expect(jobs).toHaveLength(1)
  })

  it('refuses a Version run whose half is below the smallest limit, before staging', async () => {
    const { deps, jobs, stagedTexts } = setup()
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    stagedTexts.length = 0
    const result = await handlers.run({ ...REQUEST, maxCostUsd: 0.00015 })
    expect(result).toEqual({
      kind: 'failed',
      reason: 'The cost limit is too small to share between two runs',
    })
    expect(jobs).toEqual([])
    expect(stagedTexts).toEqual([])
  })

  it('never passes a run more than the limit the user set', async () => {
    const { deps, jobs } = setup({
      reports: [
        withArmOnly((report) => {
          report.costUsd = 0.1234
        }),
        withArmOnly(),
      ],
    })
    const handlers = createEvalHandlers(deps)
    await handlers.prepare(PREPARE)
    await handlers.run({ ...REQUEST, maxCostUsd: 0.3 })
    const limits = jobs.map((job) => Number(argAfter(job, '--max-cost-usd')))
    expect(limits[0]).toBeLessThanOrEqual(0.15)
    expect(0.1234 + (limits[1] ?? 0)).toBeLessThanOrEqual(0.3)
  })
})

describe('prepare overlap', () => {
  it('keeps the latest prepare when an older one finishes last', async () => {
    const { deps, jobs } = setup()
    let releaseFirst: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let calls = 0
    const handlers = createEvalHandlers({
      ...deps,
      stage: async (path, text) => {
        calls += 1
        if (calls === 1) await gate
        return deps.stage(path, text)
      },
    })
    const slow = handlers.prepare({
      skillPath: SKILL,
      baseline: { kind: 'none' },
    })
    await vi.waitFor(() => expect(calls).toBe(1))
    await handlers.prepare(PREPARE)
    releaseFirst()
    await slow
    expect((await handlers.run(REQUEST)).kind).toBe('completed')
    expect(jobs).toHaveLength(2)
  })
})

describe('same as saved', () => {
  it("lists the Versions whose text is today's saved text", async () => {
    const { deps } = setup()
    const handlers = createEvalHandlers({
      ...deps,
      history: {
        versions: () => [version(7, 1000), version(8, 2000)],
        text: (_path, id) => (id === 8 ? TODAY : OLDER),
      },
    })
    expect(await handlers.prepare(PREPARE)).toMatchObject({
      sameAsSaved: [8],
    })
  })
})

describe('open report by side', () => {
  it('opens either side of a Version run and refuses another side', async () => {
    const { deps } = setup()
    const openPath = vi.fn(async (_file: string) => '')
    const handlers = createEvalHandlers({ ...deps, openPath })
    await handlers.prepare(PREPARE)
    await handlers.run(REQUEST)
    await handlers.openReport({ skillPath: SKILL })
    await handlers.openReport({ skillPath: SKILL, part: 'version' })
    const opened = openPath.mock.calls.map(([file]) => String(file))
    expect(opened[0]).toContain(join('last', 'today', 'report'))
    expect(opened[1]).toContain(join('last', 'version', 'report'))
    expect(
      (await handlers.openReport({ skillPath: SKILL, part: '../x' })).kind,
    ).toBe('failed')
  })
})
