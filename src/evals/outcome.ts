import { type EvalSummary, parseEvalReport, reportCost } from './report'

export type OutcomeInput = {
  readonly reportText: string | null
  readonly exitCode: number | null
  readonly signal: string | null
  readonly cancelled: boolean
  readonly maxCostUsd: number
  readonly cliVersion: string | null
}

export type RunOutcome =
  | { readonly kind: 'complete'; readonly summary: EvalSummary }
  | {
      readonly kind: 'not-complete'
      readonly message: string
      readonly costUsd: number | null
    }

const COMPLETE_EXIT_CODES: readonly (number | null)[] = [0, 1]
const CANCEL_EXIT_CODES: readonly (number | null)[] = [130, 143]
const CANCEL_SIGNALS: readonly (string | null)[] = ['SIGTERM', 'SIGINT']

const CANCELLED = 'Cancelled'

const stop = (message: string, costUsd: number | null): RunOutcome => ({
  kind: 'not-complete',
  message,
  costUsd,
})

const limitLabel = (maxCostUsd: number): string =>
  maxCostUsd.toFixed(4).replace(/0{1,2}$/, '')

const exitMessage = (exitCode: number | null, signal: string | null): string =>
  signal !== null
    ? `Claude stopped with ${signal}`
    : `Claude exited with code ${String(exitCode)}`

const endedByCancel = (
  exitCode: number | null,
  signal: string | null,
): boolean =>
  CANCEL_EXIT_CODES.includes(exitCode) || CANCEL_SIGNALS.includes(signal)

const noReportMessage = (
  exitCode: number | null,
  signal: string | null,
): string =>
  endedByCancel(exitCode, signal)
    ? CANCELLED
    : exitCode === 2
      ? 'Claude exited with code 2 before it wrote a report'
      : exitMessage(exitCode, signal)

const partialMessage = (
  reason: string | null,
  exitCode: number | null,
  signal: string | null,
  maxCostUsd: number,
): string => {
  if (reason === 'interrupted') return CANCELLED
  if (reason === 'cost_ceiling')
    return `Stopped at the cost limit (US$${limitLabel(maxCostUsd)})`
  if (reason === 'auth_failed') return 'Claude is not logged in'
  if (endedByCancel(exitCode, signal)) return CANCELLED
  const early = `Claude stopped early${reason === null ? '' : ` (${reason})`}`
  return signal !== null
    ? `${early} with ${signal}`
    : `${early} with exit code ${String(exitCode)}`
}

export const mapRunOutcome = ({
  reportText,
  exitCode,
  signal,
  cancelled,
  maxCostUsd,
  cliVersion,
}: OutcomeInput): RunOutcome => {
  const costUsd = reportText === null ? null : reportCost(reportText)
  if (cancelled) return stop(CANCELLED, costUsd)
  if (reportText === null) return stop(noReportMessage(exitCode, signal), null)
  const report = parseEvalReport(reportText, cliVersion ?? undefined)
  if (report.kind === 'refused') return stop(report.message, costUsd)
  if (report.kind === 'partial')
    return stop(
      partialMessage(report.reason, exitCode, signal, maxCostUsd),
      costUsd,
    )
  if (report.summary.cases.length === 0)
    return stop('No Evals in this skill', costUsd)
  if (!COMPLETE_EXIT_CODES.includes(exitCode))
    return stop(exitMessage(exitCode, signal), costUsd)
  return { kind: 'complete', summary: report.summary }
}
