export type Tally = {
  readonly passed: number
  readonly total: number
}

export type RunRecord = {
  readonly passed: boolean
  readonly fired: boolean | null
  readonly errored: boolean
}

export const tallyOf = (
  entries: readonly { readonly passed: boolean }[],
): Tally => ({
  passed: entries.filter(({ passed }) => passed).length,
  total: entries.length,
})

export const sumTallies = (tallies: readonly Tally[]): Tally => ({
  passed: tallies.reduce((sum, { passed }) => sum + passed, 0),
  total: tallies.reduce((sum, { total }) => sum + total, 0),
})

export const armTally = (runs: readonly RunRecord[]): Tally =>
  tallyOf(runs.filter(({ errored }) => !errored))
