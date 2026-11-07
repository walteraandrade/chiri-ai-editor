import { join } from 'node:path'
import type { RunBaseline } from '../../../src/evals/baseline'
import { buildEvalArgs } from '../../../src/evals/command'
import { compareSummaries, summaryOfStored } from '../../../src/evals/compare'
import { firstRunLimit, secondRunLimit } from '../../../src/evals/limits'
import {
  costLimitMessage,
  mapRunOutcome,
  type RunOutcome,
} from '../../../src/evals/outcome'
import { findRisks, type Risk } from '../../../src/evals/risks'
import type {
  EvalCancelResult,
  EvalOpenReportResult,
  EvalPrepareResult,
  EvalRunRequest,
  EvalRunResult,
  EvalStatus,
  StoppedRun,
} from '../../../src/evals/types'
import type { VersionList } from '../../../src/history/types'
import { SKILL_FILE_NAME } from '../../../src/skills/scan-skills'
import { attempt } from './attempt'
import {
  parseCancelRequest,
  parsePrepareRequest,
  parseRunRequest,
  parseSkillRequest,
} from './request'
import type { ResultsStore, RunPart } from './results'
import { skillKeyOf } from './results'
import type { EvalRunner } from './runner'
import type { Stage } from './stage'

export type HistoryReader = {
  readonly versions: (path: string) => VersionList
  readonly text: (path: string, id: number) => string | null
}

export type EvalDeps = {
  readonly librarySkillPaths: () => Promise<readonly string[]>
  readonly realPath: (path: string) => Promise<string>
  readonly findClaude: () => Promise<string | null>
  readonly runner: EvalRunner
  readonly stage: (skillPath: string, skillText?: string) => Promise<Stage>
  readonly results: ResultsStore
  readonly history: HistoryReader
  readonly openPath: (path: string) => Promise<string>
}

export type EvalHandlers = {
  readonly status: (input: unknown) => Promise<EvalStatus>
  readonly prepare: (input: unknown) => Promise<EvalPrepareResult>
  readonly run: (input: unknown) => Promise<EvalRunResult>
  readonly openReport: (input: unknown) => Promise<EvalOpenReportResult>
  readonly cancel: (input: unknown) => Promise<EvalCancelResult>
  readonly isRunning: () => boolean
  readonly shutdown: () => Promise<void>
}

const INVALID = { kind: 'failed', reason: 'Invalid request' } as const

const NOT_A_SKILL = {
  kind: 'failed',
  reason: 'Not a Skill in the Library',
} as const

const VERSION_GONE = {
  kind: 'failed',
  reason: "That Version is not in this Skill's History",
} as const

const SHUTDOWN_WAIT_MS = 6000

const CANCELLED = {
  kind: 'not-complete',
  message: 'Cancelled',
  costUsd: null,
} as const

type ResolvedBaseline =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'version'
      readonly versionId: number
      readonly at: number
      readonly text: string
    }

type Prepared = {
  readonly risks: readonly Risk[]
  readonly baselineRisks: readonly Risk[] | null
  readonly baseline: RunBaseline
  readonly claudeVersion: string
}

type Stages = {
  readonly today: Stage
  readonly older: Stage | null
  readonly cleanup: () => Promise<void>
}

const sameRisks = (
  left: readonly Risk[] | null,
  right: readonly Risk[] | null,
): boolean => JSON.stringify(left) === JSON.stringify(right)

const stageRisks = (stage: Stage): readonly Risk[] =>
  findRisks({ skillText: stage.skillText, leftOut: stage.leftOut })

const risksOf = (
  stages: Stages,
): {
  readonly risks: readonly Risk[]
  readonly baselineRisks: readonly Risk[] | null
} => ({
  risks: stageRisks(stages.today),
  baselineRisks: stages.older === null ? null : stageRisks(stages.older),
})

const sameBaseline = (left: RunBaseline, right: RunBaseline): boolean =>
  left.kind === right.kind &&
  (left.kind === 'none' ||
    (right.kind === 'version' && left.versionId === right.versionId))

const asResult = (
  outcome: RunOutcome & { kind: 'not-complete' },
): EvalRunResult => outcome

const addCost = (spent: number, costUsd: number | null): number =>
  spent + (costUsd ?? 0)

export const createEvalHandlers = (deps: EvalDeps): EvalHandlers => {
  const prepared = new Map<string, Prepared>()
  const stopped = new Map<string, StoppedRun>()
  let running = false
  let runningKey: string | null = null
  let committing = false
  let abort = new AbortController()
  let inflight: Promise<unknown> = Promise.resolve()

  const libraryRealPath = async (path: string): Promise<string | null> => {
    const real = await attempt(() => deps.realPath(path))
    if (real === undefined) return null
    const inLibrary = (await deps.librarySkillPaths()).includes(real)
    return inLibrary ? real : null
  }

  const cliVersion = async (executable: string): Promise<string | null> =>
    deps.runner.version(executable)

  const lastSummary = async (key: string) => {
    const last = await deps.results.readLast(key)
    return last === null ? null : summaryOfStored(last)
  }

  const historyOf = async (
    real: string,
  ): Promise<{
    readonly file: string
    readonly versions: VersionList
  } | null> => {
    const file = await attempt(() => deps.realPath(join(real, SKILL_FILE_NAME)))
    if (file === undefined) return null
    const versions = await attempt(async () => deps.history.versions(file))
    return versions === undefined ? null : { file, versions }
  }

  const resolveBaseline = async (
    real: string,
    baseline: RunBaseline,
  ): Promise<ResolvedBaseline | null> => {
    if (baseline.kind === 'none') return baseline
    const history = await historyOf(real)
    const found = history?.versions.find(({ id }) => id === baseline.versionId)
    if (history === null || found === undefined) return null
    const text = await attempt(async () =>
      deps.history.text(history.file, baseline.versionId),
    )
    return text === undefined || text === null
      ? null
      : {
          kind: 'version',
          versionId: baseline.versionId,
          at: found.at,
          text,
        }
  }

  const openStages = async (
    real: string,
    baseline: ResolvedBaseline,
  ): Promise<Stages | undefined> => {
    const today = await attempt(() => deps.stage(real))
    if (today === undefined) return undefined
    if (baseline.kind === 'none')
      return { today, older: null, cleanup: () => today.cleanup() }
    const older = await attempt(() => deps.stage(real, baseline.text))
    if (older === undefined) {
      await attempt(today.cleanup)
      return undefined
    }
    return {
      today,
      older,
      cleanup: async () => {
        await attempt(today.cleanup)
        await attempt(older.cleanup)
      },
    }
  }

  const status = async (input: unknown): Promise<EvalStatus> => {
    const request = parseSkillRequest(input)
    if (request === null) return INVALID
    const real = await libraryRealPath(request.skillPath)
    if (real === null) return NOT_A_SKILL
    const executable = await deps.findClaude()
    if (executable === null) return { kind: 'no-cli' }
    const claudeVersion = await cliVersion(executable)
    if (claudeVersion === null)
      return { kind: 'failed', reason: 'Could not run claude' }
    const key = skillKeyOf(real)
    const here = running && runningKey === key
    return {
      kind: 'ready',
      claudeVersion,
      last: await lastSummary(key),
      running: here,
      cancelling: here && abort.signal.aborted,
      stopped: stopped.get(key) ?? null,
    }
  }

  const prepare = async (input: unknown): Promise<EvalPrepareResult> => {
    const request = parsePrepareRequest(input)
    if (request === null) return INVALID
    const real = await libraryRealPath(request.skillPath)
    if (real === null) return NOT_A_SKILL
    const executable = await deps.findClaude()
    if (executable === null) return { kind: 'no-cli' }
    const claudeVersion = await cliVersion(executable)
    if (claudeVersion === null)
      return { kind: 'failed', reason: 'Could not run claude' }
    const resolved = await resolveBaseline(real, request.baseline)
    if (resolved === null) return VERSION_GONE
    const versions = (await historyOf(real))?.versions ?? []
    const stages = await openStages(real, resolved)
    if (stages === undefined)
      return { kind: 'failed', reason: 'Could not stage the Skill' }
    try {
      const { risks, baselineRisks } = risksOf(stages)
      prepared.set(skillKeyOf(real), {
        risks,
        baselineRisks,
        baseline: request.baseline,
        claudeVersion,
      })
      return {
        kind: 'ready',
        claudeVersion,
        caseCount: stages.today.caseCount,
        risks,
        baselineRisks,
        versions,
      }
    } finally {
      await attempt(stages.cleanup)
    }
  }

  const runOne = async (
    key: string,
    executable: string,
    stage: Stage,
    files: { readonly jsonFile: string; readonly outputDir: string },
    part: RunPart | undefined,
    request: EvalRunRequest,
    limit: number,
    claudeVersion: string,
  ): Promise<RunOutcome> => {
    const { signal } = abort
    const args = buildEvalArgs({
      runs: request.runs,
      model: request.model,
      maxCostUsd: limit,
      ...files,
      ablationNone: request.baseline.kind === 'version',
    })
    if (signal.aborted) return CANCELLED
    const exit = await deps.runner.run({ executable, args, cwd: stage.dir })
    const reportText = await deps.results.readNext(key, part)
    return mapRunOutcome({
      reportText,
      ...exit,
      cancelled: signal.aborted,
      maxCostUsd: request.maxCostUsd,
      cliVersion: claudeVersion,
    })
  }

  const runAgainstNoSkill = async (
    key: string,
    executable: string,
    stage: Stage,
    request: EvalRunRequest,
    claudeVersion: string,
  ): Promise<EvalRunResult> => {
    const files = await deps.results.begin(key)
    const outcome = await runOne(
      key,
      executable,
      stage,
      files,
      undefined,
      request,
      request.maxCostUsd,
      claudeVersion,
    )
    if (outcome.kind === 'not-complete') return asResult(outcome)
    committing = true
    await deps.results.promote(key)
    return { kind: 'completed', summary: outcome.summary }
  }

  const runAgainstVersion = async (
    key: string,
    executable: string,
    stages: Stages & { readonly older: Stage },
    baseline: Extract<ResolvedBaseline, { kind: 'version' }>,
    request: EvalRunRequest,
    claudeVersion: string,
  ): Promise<EvalRunResult> => {
    const { signal } = abort
    await deps.results.begin(key)
    const first = await runOne(
      key,
      executable,
      stages.today,
      await deps.results.beginPart(key, 'today'),
      'today',
      request,
      firstRunLimit(request.maxCostUsd),
      claudeVersion,
    )
    if (first.kind === 'not-complete') return asResult(first)
    const spent = first.summary.costUsd
    if (signal.aborted) return { ...CANCELLED, costUsd: spent }
    const secondLimit = secondRunLimit(request.maxCostUsd, spent)
    if (secondLimit === null)
      return {
        kind: 'not-complete',
        message: costLimitMessage(request.maxCostUsd),
        costUsd: spent,
      }
    const second = await runOne(
      key,
      executable,
      stages.older,
      await deps.results.beginPart(key, 'version'),
      'version',
      request,
      secondLimit,
      claudeVersion,
    )
    if (second.kind === 'not-complete')
      return asResult({
        ...second,
        costUsd: addCost(spent, second.costUsd),
      })
    const stored = {
      kind: 'version',
      versionId: baseline.versionId,
      at: baseline.at,
    } as const
    const summary = compareSummaries(first.summary, second.summary, stored)
    await deps.results.writeBaseline(key, JSON.stringify(stored))
    if (signal.aborted) return { ...CANCELLED, costUsd: summary.costUsd }
    committing = true
    await deps.results.promote(key)
    return { kind: 'completed', summary }
  }

  const execute = async (
    real: string,
    key: string,
    executable: string,
    request: EvalRunRequest,
  ): Promise<EvalRunResult> => {
    const { signal } = abort
    const remembered = prepared.get(key)
    prepared.delete(key)
    const baseline = await resolveBaseline(real, request.baseline)
    if (baseline === null) return signal.aborted ? CANCELLED : VERSION_GONE
    const stages = await openStages(real, baseline)
    if (stages === undefined)
      return signal.aborted
        ? CANCELLED
        : { kind: 'failed', reason: 'Could not stage the Skill' }
    try {
      if (signal.aborted) return CANCELLED
      const now = risksOf(stages)
      if (
        remembered === undefined ||
        !sameBaseline(remembered.baseline, request.baseline) ||
        !sameRisks(remembered.risks, now.risks) ||
        !sameRisks(remembered.baselineRisks, now.baselineRisks)
      ) {
        return { kind: 'risks-changed' }
      }
      if (baseline.kind === 'version' && stages.older !== null)
        return await runAgainstVersion(
          key,
          executable,
          { ...stages, older: stages.older },
          baseline,
          request,
          remembered.claudeVersion,
        )
      return await runAgainstNoSkill(
        key,
        executable,
        stages.today,
        request,
        remembered.claudeVersion,
      )
    } catch {
      return signal.aborted
        ? CANCELLED
        : { kind: 'failed', reason: 'Could not run claude' }
    } finally {
      await attempt(stages.cleanup)
      await attempt(() => deps.results.discard(key))
    }
  }

  const run = async (input: unknown): Promise<EvalRunResult> => {
    const request = parseRunRequest(input)
    if (request === null) return INVALID
    if (running) return { kind: 'busy' }
    running = true
    committing = false
    runningKey = null
    abort = new AbortController()
    const { signal } = abort
    let release: () => void = () => undefined
    inflight = new Promise<void>((resolve) => {
      release = resolve
    })
    let key: string | null = null
    try {
      const real = await libraryRealPath(request.skillPath)
      if (signal.aborted) return CANCELLED
      if (real === null) return NOT_A_SKILL
      key = skillKeyOf(real)
      runningKey = key
      stopped.delete(key)
      const executable = await deps.findClaude()
      if (signal.aborted) return CANCELLED
      if (executable === null) return { kind: 'no-cli' }
      const result = await execute(real, key, executable, request)
      if (result.kind === 'not-complete')
        stopped.set(key, { message: result.message, costUsd: result.costUsd })
      return result
    } finally {
      running = false
      runningKey = null
      release()
    }
  }

  const stopRun = (): boolean => {
    if (!running || committing) return false
    abort.abort()
    deps.runner.kill()
    return true
  }

  const cancel = async (input: unknown): Promise<EvalCancelResult> => {
    if (parseCancelRequest(input) === null) return INVALID
    return stopRun() ? { kind: 'cancelling' } : { kind: 'idle' }
  }

  const shutdown = async (): Promise<void> => {
    if (!running) return
    stopRun()
    await Promise.race([
      inflight,
      new Promise((r) => setTimeout(r, SHUTDOWN_WAIT_MS)),
    ])
  }

  const openReport = async (input: unknown): Promise<EvalOpenReportResult> => {
    const request = parseSkillRequest(input)
    if (request === null) return INVALID
    const real = await libraryRealPath(request.skillPath)
    if (real === null) return NOT_A_SKILL
    const report = await deps.results.lastReport(skillKeyOf(real))
    if (report === null)
      return { kind: 'failed', reason: 'There is no report yet' }
    const problem = await deps.openPath(report)
    return problem === ''
      ? { kind: 'opened' }
      : { kind: 'failed', reason: 'Could not open the report' }
  }

  return {
    status,
    prepare,
    run,
    openReport,
    cancel,
    isRunning: () => running,
    shutdown,
  }
}
