import { describe, expect, it } from 'vitest'
import { compareReports, compareSummaries, summaryOfStored } from './compare'
import { type CaseTally, type EvalSummary, parseEvalReport } from './report'
import { armTally, type RunRecord, sumTallies } from './tally'

const run = (
  passed: boolean,
  fired: boolean | null = null,
  errored = false,
): RunRecord => ({ passed, fired, errored })

const caseOf = (name: string, runs: readonly RunRecord[]): CaseTally => ({
  name,
  with: armTally(runs),
  without: null,
  runs: { with: runs, without: null },
})

const summaryOf = (
  cases: readonly CaseTally[],
  costUsd = 0.01,
): EvalSummary => ({
  claudeVersion: '2.1.319',
  startedAt: '2026-11-07T20:00:00.000Z',
  costUsd,
  cases,
  with: sumTallies(cases.map((item) => item.with)),
  without: null,
  baseline: { kind: 'none' },
})

const baseline = { kind: 'version', versionId: 7, at: 123 } as const

describe('compareSummaries', () => {
  it("puts today's passes on one side and the Version's on the other, per Eval", () => {
    const today = summaryOf([
      caseOf('a', [run(true, true), run(true, true)]),
      caseOf('b', [run(false), run(true)]),
    ])
    const older = summaryOf([
      caseOf('a', [run(true, false), run(false, false)]),
      caseOf('b', [run(false), run(false)]),
    ])
    const result = compareSummaries(today, older, baseline)
    expect(
      result.cases.map((item) => [item.name, item.with, item.without]),
    ).toEqual([
      ['a', { passed: 2, total: 2 }, { passed: 1, total: 2 }],
      ['b', { passed: 1, total: 2 }, { passed: 0, total: 2 }],
    ])
    expect(result.with).toEqual({ passed: 3, total: 4 })
    expect(result.without).toEqual({ passed: 1, total: 4 })
    expect(result.baseline).toEqual(baseline)
  })

  it('keeps the fired records of the Version side', () => {
    const result = compareSummaries(
      summaryOf([caseOf('a', [run(true, true)])]),
      summaryOf([caseOf('a', [run(true, false)])]),
      baseline,
    )
    expect(result.cases[0]?.runs.without).toEqual([run(true, false)])
  })

  it('sums the cost of both runs and keeps the first run for the rest', () => {
    const result = compareSummaries(
      summaryOf([caseOf('a', [run(true)])], 0.01),
      summaryOf([caseOf('a', [run(true)])], 0.02),
      baseline,
    )
    expect(result.costUsd).toBeCloseTo(0.03)
    expect(result.startedAt).toBe('2026-11-07T20:00:00.000Z')
  })

  it('leaves an Eval that only today has with no side for the Version', () => {
    const result = compareSummaries(
      summaryOf([caseOf('a', [run(true)]), caseOf('only-today', [run(true)])]),
      summaryOf([caseOf('a', [run(false)])]),
      baseline,
    )
    const extra = result.cases.find((item) => item.name === 'only-today')
    expect(extra?.without).toBeNull()
    expect(extra?.runs.without).toBeNull()
    expect(extra?.with).toEqual({ passed: 1, total: 1 })
    expect(result.without).toEqual({ passed: 0, total: 1 })
  })

  it('keeps an Eval that only the Version has, with an empty side for today', () => {
    const result = compareSummaries(
      summaryOf([caseOf('a', [run(true)])]),
      summaryOf([caseOf('a', [run(true)]), caseOf('only-older', [run(true)])]),
      baseline,
    )
    const extra = result.cases.find((item) => item.name === 'only-older')
    expect(extra?.with).toEqual({ passed: 0, total: 0 })
    expect(extra?.runs.with).toEqual([])
    expect(extra?.without).toEqual({ passed: 1, total: 1 })
  })
})

const report = (partial: boolean, name = 'a'): string =>
  JSON.stringify({
    schemaVersion: 1,
    claudeVersion: '2.1.319',
    startedAt: '2026-11-07T20:00:00.000Z',
    costUsd: 0.01,
    partial,
    partialReason: partial ? 'interrupted' : null,
    cases: [
      {
        name,
        graders: [],
        arms: { with: [{ passed: true, graders: [] }] },
      },
    ],
  })

describe('compareReports', () => {
  it('is complete when both reports are, reading each with the Adapter', () => {
    const outcome = compareReports(report(false), report(false), baseline)
    expect(outcome.kind).toBe('complete')
    expect(parseEvalReport(report(false)).kind).toBe('complete')
  })

  it('is not complete when either report is partial', () => {
    expect(compareReports(report(true), report(false), baseline).kind).toBe(
      'partial',
    )
    expect(compareReports(report(false), report(true), baseline).kind).toBe(
      'partial',
    )
  })

  it('refuses when either report cannot be read', () => {
    expect(compareReports('nope', report(false), baseline).kind).toBe('refused')
    expect(compareReports(report(false), 'nope', baseline).kind).toBe('refused')
  })
})

describe('summaryOfStored', () => {
  it('reads a run with no baseline file as a run against no Skill', () => {
    const summary = summaryOfStored({
      baselineText: null,
      firstText: report(false),
      secondText: null,
    })
    expect(summary?.baseline).toEqual({ kind: 'none' })
  })

  it('reads a Version run from both reports and the baseline file', () => {
    const summary = summaryOfStored({
      baselineText: JSON.stringify(baseline),
      firstText: report(false),
      secondText: report(false),
    })
    expect(summary?.baseline).toEqual(baseline)
  })

  it('shows nothing when the baseline file, or the second report, is missing or broken', () => {
    expect(
      summaryOfStored({
        baselineText: 'x',
        firstText: report(false),
        secondText: null,
      }),
    ).toBeNull()
    expect(
      summaryOfStored({
        baselineText: JSON.stringify(baseline),
        firstText: report(false),
        secondText: null,
      }),
    ).toBeNull()
    expect(
      summaryOfStored({
        baselineText: JSON.stringify(baseline),
        firstText: report(false),
        secondText: report(true),
      }),
    ).toBeNull()
  })
})
