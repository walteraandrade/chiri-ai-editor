import { buildEvalArgs } from '../../../src/evals/command'
import { parseEvalReport } from '../../../src/evals/report'
import { findRisks, type Risk } from '../../../src/evals/risks'
import type {
  EvalOpenReportResult,
  EvalPrepareResult,
  EvalRunResult,
  EvalStatus,
} from '../../../src/evals/types'
import { parseRunRequest, parseSkillRequest } from './request'
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
}

const INVALID = { kind: 'failed', reason: 'Invalid request' } as const

const NOT_A_SKILL = {
  kind: 'failed',
  reason: 'Not a Skill in the Library',
} as const

const COMPLETE_EXIT_CODES: readonly (number | null)[] = [0, 1]

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const sameRisks = (left: readonly Risk[], right: readonly Risk[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const stageRisks = (stage: Stage): readonly Risk[] =>
  findRisks({ skillText: stage.skillText, leftOut: stage.leftOut })

const exitMessage = (exitCode: number | null, signal: string | null): string =>
  signal !== null
    ? `Claude stopped with ${signal}`
    : `Claude exited with code ${String(exitCode)}`

export const createEvalHandlers = (deps: EvalDeps): EvalHandlers => {
  const prepared = new Map<string, readonly Risk[]>()
  let running = false

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
    return {
      kind: 'ready',
      claudeVersion,
      last: await lastSummary(skillKeyOf(real)),
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
      prepared.set(skillKeyOf(real), risks)
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
    exitCode: number | null,
    signal: string | null,
  ): Promise<EvalRunResult> => {
    const text = await deps.results.readNext(key)
    if (text === null)
      return { kind: 'not-complete', message: exitMessage(exitCode, signal) }
    const outcome = parseEvalReport(text)
    if (outcome.kind === 'refused')
      return { kind: 'not-complete', message: outcome.message }
    if (outcome.kind === 'partial' || !COMPLETE_EXIT_CODES.includes(exitCode))
      return { kind: 'not-complete', message: exitMessage(exitCode, signal) }
    await deps.results.promote(key)
    return { kind: 'completed', summary: outcome.summary }
  }

  const execute = async (
    real: string,
    key: string,
    executable: string,
    request: NonNullable<ReturnType<typeof parseRunRequest>>,
  ): Promise<EvalRunResult> => {
    const remembered = prepared.get(key)
    const stage = await attempt(() => deps.stage(real))
    if (stage === undefined)
      return { kind: 'failed', reason: 'Could not stage the Skill' }
    try {
      if (
        remembered === undefined ||
        !sameRisks(remembered, stageRisks(stage))
      ) {
        prepared.delete(key)
        return { kind: 'risks-changed' }
      }
      const next = await deps.results.begin(key)
      const args = buildEvalArgs({ ...request, ...next })
      const exit = await deps.runner.run({
        executable,
        args,
        cwd: stage.dir,
      })
      return await finish(key, exit.exitCode, exit.signal)
    } catch {
      return { kind: 'failed', reason: 'Could not run claude' }
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
    try {
      const real = await libraryRealPath(request.skillPath)
      if (real === null) return NOT_A_SKILL
      const executable = await deps.findClaude()
      if (executable === null) return { kind: 'no-cli' }
      return await execute(real, skillKeyOf(real), executable, request)
    } finally {
      running = false
    }
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

  return { status, prepare, run, openReport }
}
