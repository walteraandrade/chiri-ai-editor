import type { CaseTally, RunRecord, Tally } from './report'

export type SuspiciousKind =
  | 'passes-in-both'
  | 'fails-in-both'
  | 'runs-disagree'

export type Verdict = 'more' | 'same' | 'fewer'

export type Helped = {
  readonly with: Tally
  readonly without: Tally | null
  readonly verdict: Verdict | null
}

export type CaseSignals = {
  readonly name: string
  readonly fired: Tally | null
  readonly helped: Helped
  readonly suspicious: readonly SuspiciousKind[]
}

const tallyOf = (runs: readonly RunRecord[]): Tally => ({
  passed: runs.filter(({ passed }) => passed).length,
  total: runs.length,
})

const firedOf = (runs: readonly RunRecord[]): Tally | null => {
  const checked = runs.filter(({ fired }) => fired !== null)
  return checked.length === 0
    ? null
    : {
        passed: checked.filter(({ fired }) => fired === true).length,
        total: checked.length,
      }
}

const rate = ({ passed, total }: Tally): number =>
  total === 0 ? 0 : passed / total

const verdictOf = (
  withTally: Tally,
  withoutTally: Tally | null,
): Verdict | null => {
  if (
    withoutTally === null ||
    withTally.total === 0 ||
    withoutTally.total === 0
  )
    return null
  const difference = rate(withTally) - rate(withoutTally)
  return difference > 0 ? 'more' : difference < 0 ? 'fewer' : 'same'
}

const allPass = ({ passed, total }: Tally): boolean =>
  total > 0 && passed === total

const nonePass = ({ passed, total }: Tally): boolean =>
  total > 0 && passed === 0

const mixed = ({ passed, total }: Tally): boolean =>
  passed > 0 && passed < total

const suspiciousOf = (
  withTally: Tally,
  withoutTally: Tally | null,
): readonly SuspiciousKind[] => {
  const arms = withoutTally === null ? [withTally] : [withTally, withoutTally]
  const pair = withoutTally !== null
  return [
    ...(pair && arms.every(allPass) ? (['passes-in-both'] as const) : []),
    ...(pair && arms.every(nonePass) ? (['fails-in-both'] as const) : []),
    ...(arms.some(mixed) ? (['runs-disagree'] as const) : []),
  ]
}

export const caseSignals = ({ name, runs }: CaseTally): CaseSignals => {
  const withTally = tallyOf(runs.with)
  const withoutTally = runs.without === null ? null : tallyOf(runs.without)
  return {
    name,
    fired: firedOf(runs.with),
    helped: {
      with: withTally,
      without: withoutTally,
      verdict: verdictOf(withTally, withoutTally),
    },
    suspicious: suspiciousOf(withTally, withoutTally),
  }
}

export const firedOverall = (cases: readonly CaseTally[]): Tally | null => {
  const tallies = cases.flatMap((item) => {
    const fired = caseSignals(item).fired
    return fired === null ? [] : [fired]
  })
  return tallies.length === 0
    ? null
    : {
        passed: tallies.reduce((sum, { passed }) => sum + passed, 0),
        total: tallies.reduce((sum, { total }) => sum + total, 0),
      }
}
