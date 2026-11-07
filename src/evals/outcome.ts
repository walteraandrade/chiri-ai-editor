import { type EvalSummary, parseEvalReport } from './report'

export type OutcomeInput = {
  readonly reportText: string | null
  readonly exitCode: number | null
  readonly signal: string | null
  readonly cancelled: boolean
  readonly maxCostUsd: number
}

export type RunOutcome =
  | { readonly kind: 'complete'; readonly summary: EvalSummary }
  | { readonly kind: 'not-complete'; readonly message: string }

const COMPLETE_EXIT_CODES: readonly (number | null)[] = [0, 1]
const CANCEL_EXIT_CODES: readonly (number | null)[] = [130, 143]
const CANCEL_SIGNALS: readonly (string | null)[] = ['SIGTERM', 'SIGINT']

const CANCELLED = 'Cancelled'

const stop = (message: string): RunOutcome => ({
  kind: 'not-complete',
  message,
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
  return `Claude stopped early${reason === null ? '' : ` (${reason})`} with exit code ${String(exitCode)}`
}

export const mapRunOutcome = ({
  reportText,
  exitCode,
  signal,
  cancelled,
  maxCostUsd,
}: OutcomeInput): RunOutcome => {
  if (cancelled) return stop(CANCELLED)
  if (reportText === null) return stop(noReportMessage(exitCode, signal))
  const report = parseEvalReport(reportText)
  if (report.kind === 'refused') return stop(report.message)
  if (report.kind === 'partial')
    return stop(partialMessage(report.reason, exitCode, signal, maxCostUsd))
  if (!COMPLETE_EXIT_CODES.includes(exitCode))
    return stop(exitMessage(exitCode, signal))
  if (report.summary.cases.length === 0 && exitCode === 1)
    return stop('No Evals in this skill')
  return { kind: 'complete', summary: report.summary }
}
