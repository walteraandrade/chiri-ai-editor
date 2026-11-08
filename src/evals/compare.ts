import { parseSummaryBaseline, type SummaryBaseline } from './baseline'
import {
  type CaseTally,
  type EvalSummary,
  parseEvalReport,
  type ReportOutcome,
} from './report'
import { sumTallies } from './tally'

export type VersionBaseline = Extract<SummaryBaseline, { kind: 'version' }>

const EMPTY = { passed: 0, total: 0 } as const

const caseOf = (
  name: string,
  today: CaseTally | undefined,
  older: CaseTally | undefined,
): CaseTally => ({
  name,
  with: today?.with ?? EMPTY,
  without: older?.with ?? null,
  runs: {
    with: today?.runs.with ?? [],
    without: older?.runs.with ?? null,
  },
})

export const compareSummaries = (
  today: EvalSummary,
  older: EvalSummary,
  baseline: VersionBaseline,
): EvalSummary => {
  const todayByName = new Map(today.cases.map((item) => [item.name, item]))
  const olderByName = new Map(older.cases.map((item) => [item.name, item]))
  const names = [...new Set([...todayByName.keys(), ...olderByName.keys()])]
  const cases = names.map((name) =>
    caseOf(name, todayByName.get(name), olderByName.get(name)),
  )
  const olderTallies = cases.flatMap(({ without }) =>
    without === null ? [] : [without],
  )
  return {
    claudeVersion: today.claudeVersion,
    startedAt: today.startedAt,
    costUsd: today.costUsd + older.costUsd,
    cases,
    with: sumTallies(cases.map((item) => item.with)),
    without: olderTallies.length === 0 ? null : sumTallies(olderTallies),
    baseline,
  }
}

export const compareReports = (
  todayText: string,
  olderText: string,
  baseline: VersionBaseline,
  cliVersion?: string,
): ReportOutcome => {
  const today = parseEvalReport(todayText, cliVersion)
  if (today.kind !== 'complete') return today
  const older = parseEvalReport(olderText, cliVersion)
  if (older.kind !== 'complete') return older
  return {
    kind: 'complete',
    summary: compareSummaries(today.summary, older.summary, baseline),
  }
}

export type StoredRun = {
  readonly baselineText: string | null
  readonly firstText: string
  readonly secondText: string | null
}

export const summaryOfStored = ({
  baselineText,
  firstText,
  secondText,
}: StoredRun): EvalSummary | null => {
  const baseline =
    baselineText === null
      ? { kind: 'none' as const }
      : parseSummaryBaseline(baselineText)
  if (baseline === null) return null
  if (baseline.kind === 'none') {
    const outcome = parseEvalReport(firstText)
    return outcome.kind === 'complete' ? outcome.summary : null
  }
  if (secondText === null) return null
  const outcome = compareReports(firstText, secondText, baseline)
  return outcome.kind === 'complete' ? outcome.summary : null
}
