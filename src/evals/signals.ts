import type { CaseTally, RunRecord, Tally } from './report'
import { armTally, sumTallies } from './tally'

export type SuspiciousKind =
  | 'passes-in-both'
  | 'fails-in-both'
  | 'runs-disagree'

export type CaseSignals = {
  readonly name: string
  readonly fired: Tally | null
  readonly errored: number
  readonly suspicious: readonly SuspiciousKind[]
}

export type HelpedOverall = {
  readonly with: Tally
  readonly without: Tally
  readonly leftOut: number
}

const firedOf = (runs: readonly RunRecord[]): Tally | null => {
  const checked = runs.filter(
    ({ fired, errored }) => fired !== null && !errored,
  )
  return checked.length === 0
    ? null
    : {
        passed: checked.filter(({ fired }) => fired === true).length,
        total: checked.length,
      }
}

const allPass = ({ passed, total }: Tally): boolean =>
  total > 0 && passed === total

const nonePass = ({ passed, total }: Tally): boolean =>
  total > 0 && passed === 0

const mixed = ({ passed, total }: Tally): boolean =>
  passed > 0 && passed < total

const suspiciousOf = (
  first: Tally,
  second: Tally | null,
): readonly SuspiciousKind[] => {
  const arms = second === null ? [first] : [first, second]
  const pair = second !== null
  return [
    ...(pair && arms.every(allPass) ? (['passes-in-both'] as const) : []),
    ...(pair && arms.every(nonePass) ? (['fails-in-both'] as const) : []),
    ...(arms.some(mixed) ? (['runs-disagree'] as const) : []),
  ]
}

const erroredIn = (runs: readonly RunRecord[] | null): number =>
  runs === null ? 0 : runs.filter(({ errored }) => errored).length

export const signalsOf = (
  name: string,
  first: readonly RunRecord[],
  second: readonly RunRecord[] | null,
): CaseSignals => ({
  name,
  fired: firedOf(first),
  errored: erroredIn(first) + erroredIn(second),
  suspicious: suspiciousOf(
    armTally(first),
    second === null ? null : armTally(second),
  ),
})

export const caseSignals = ({ name, runs }: CaseTally): CaseSignals =>
  signalsOf(name, runs.with, runs.without)

export const firedOverall = (cases: readonly CaseTally[]): Tally | null => {
  const tallies = cases.flatMap((item) => {
    const fired = caseSignals(item).fired
    return fired === null ? [] : [fired]
  })
  return tallies.length === 0 ? null : sumTallies(tallies)
}

export const helpedOverall = (
  cases: readonly CaseTally[],
): HelpedOverall | null => {
  const paired = cases.flatMap(({ with: withTally, without }) =>
    without === null ? [] : [{ withTally, without }],
  )
  return paired.length === 0
    ? null
    : {
        with: sumTallies(paired.map(({ withTally }) => withTally)),
        without: sumTallies(paired.map(({ without }) => without)),
        leftOut: cases.length - paired.length,
      }
}
