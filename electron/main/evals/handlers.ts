import { buildEvalArgs } from '../../../src/evals/command'
import { mapRunOutcome } from '../../../src/evals/outcome'
import { parseEvalReport } from '../../../src/evals/report'
import { findRisks, type Risk } from '../../../src/evals/risks'
import type {
  EvalCancelResult,
  EvalOpenReportResult,
  EvalPrepareResult,
  EvalRunResult,
  EvalStatus,
  StoppedRun,
} from '../../../src/evals/types'
import { attempt } from './attempt'
import {
  parseCancelRequest,
  parseRunRequest,
  parseSkillRequest,
} from './request'
import type { ResultsStore } from './results'
import { skillKeyOf } from './results'
import type { EvalRunner } from './runner'
import type { Stage } from './stage'

export type EvalDeps = {
  readonly librarySkillPaths: () => Promise<readonly string[]>
  readonly realPath: (path: string) => Promise<string>
  readonly findClaude: () => Promise<string | null>
  readonly runner: EvalRunner
  readonly stage: (skillPath: string) => Promise<Stage>
  readonly results: ResultsStore
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

const SHUTDOWN_WAIT_MS = 6000

const CANCELLED = {
  kind: 'not-complete',
  message: 'Cancelled',
  costUsd: null,
} as const

type Prepared = {
  readonly risks: readonly Risk[]
  readonly claudeVersion: string
}

const sameRisks = (left: readonly Risk[], right: readonly Risk[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const stageRisks = (stage: Stage): readonly Risk[] =>
  findRisks({ skillText: stage.skillText, leftOut: stage.leftOut })

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
    const text = await deps.results.readLast(key)
    if (text === null) return null
    const outcome = parseEvalReport(text)
    return outcome.kind === 'complete' ? outcome.summary : null
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
    const request = parseSkillRequest(input)
    if (request === null) return INVALID
    const real = await libraryRealPath(request.skillPath)
    if (real === null) return NOT_A_SKILL
    const executable = await deps.findClaude()
    if (executable === null) return { kind: 'no-cli' }
    const claudeVersion = await cliVersion(executable)
    if (claudeVersion === null)
      return { kind: 'failed', reason: 'Could not run claude' }
    const stage = await attempt(() => deps.stage(real))
    if (stage === undefined)
      return { kind: 'failed', reason: 'Could not stage the Skill' }
    try {
      const risks = stageRisks(stage)
      prepared.set(skillKeyOf(real), { risks, claudeVersion })
      return {
        kind: 'ready',
        claudeVersion,
        caseCount: stage.caseCount,
        risks,
      }
    } finally {
      await attempt(stage.cleanup)
    }
  }

  const finish = async (
    key: string,
    exit: { readonly exitCode: number | null; readonly signal: string | null },
    request: { readonly maxCostUsd: number },
    claudeVersion: string,
    signal: AbortSignal,
  ): Promise<EvalRunResult> => {
    const reportText = await deps.results.readNext(key)
    const outcome = mapRunOutcome({
      reportText,
      ...exit,
      cancelled: signal.aborted,
      maxCostUsd: request.maxCostUsd,
      cliVersion: claudeVersion,
    })
    if (outcome.kind === 'not-complete') return outcome
    committing = true
    await deps.results.promote(key)
    return { kind: 'completed', summary: outcome.summary }
  }

  const execute = async (
    real: string,
    key: string,
    executable: string,
    request: NonNullable<ReturnType<typeof parseRunRequest>>,
  ): Promise<EvalRunResult> => {
    const { signal } = abort
    const remembered = prepared.get(key)
    prepared.delete(key)
    const stage = await attempt(() => deps.stage(real))
    if (stage === undefined)
      return signal.aborted
        ? CANCELLED
        : { kind: 'failed', reason: 'Could not stage the Skill' }
    try {
      if (signal.aborted) return CANCELLED
      if (
        remembered === undefined ||
        !sameRisks(remembered.risks, stageRisks(stage))
      ) {
        return { kind: 'risks-changed' }
      }
      const next = await deps.results.begin(key)
      const args = buildEvalArgs({ ...request, ...next })
      if (signal.aborted) return CANCELLED
      const exit = await deps.runner.run({
        executable,
        args,
        cwd: stage.dir,
      })
      return await finish(key, exit, request, remembered.claudeVersion, signal)
    } catch {
      return signal.aborted
        ? CANCELLED
        : { kind: 'failed', reason: 'Could not run claude' }
    } finally {
      await attempt(stage.cleanup)
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
