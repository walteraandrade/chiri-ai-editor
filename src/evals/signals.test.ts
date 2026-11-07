import { describe, expect, it } from 'vitest'
import type { CaseTally, RunRecord } from './report'
import { caseSignals, firedOverall } from './signals'

const run = (passed: boolean, fired: boolean | null = null): RunRecord => ({
  passed,
  fired,
})

const tally = (runs: readonly RunRecord[]) => ({
  passed: runs.filter(({ passed }) => passed).length,
  total: runs.length,
})

const item = (
  withRuns: readonly RunRecord[],
  withoutRuns: readonly RunRecord[] | null,
): CaseTally => ({
  name: 'case',
  with: tally(withRuns),
  without: withoutRuns === null ? null : tally(withoutRuns),
  runs: { with: withRuns, without: withoutRuns },
})

describe('fired', () => {
  it('counts the runs in the Arm with the Skill where it fired', () => {
    const signals = caseSignals(
      item([run(true, true), run(true, false), run(false, true)], [run(false)]),
    )
    expect(signals.fired).toEqual({ passed: 2, total: 3 })
  })

  it('is not checked when the case has no tool_used Skill grader', () => {
    expect(caseSignals(item([run(true)], [run(false)])).fired).toBeNull()
  })

  it('is zero, not unchecked, when the Skill never fired', () => {
    expect(caseSignals(item([run(true, false)], [run(false)])).fired).toEqual({
      passed: 0,
      total: 1,
    })
  })
})

describe('helped', () => {
  it('keeps the passes of both Arms as counts', () => {
    const { helped } = caseSignals(
      item(
        [run(true), run(true), run(false)],
        [run(true), run(false), run(false)],
      ),
    )
    expect(helped).toEqual({
      with: { passed: 2, total: 3 },
      without: { passed: 1, total: 3 },
      verdict: 'more',
    })
  })

  it('says same and fewer', () => {
    expect(
      caseSignals(item([run(true), run(false)], [run(true), run(false)])).helped
        .verdict,
    ).toBe('same')
    expect(caseSignals(item([run(false)], [run(true)])).helped.verdict).toBe(
      'fewer',
    )
  })

  it('has no verdict without a second Arm', () => {
    expect(caseSignals(item([run(true)], null)).helped).toEqual({
      with: { passed: 1, total: 1 },
      without: null,
      verdict: null,
    })
  })
})

describe('suspicious kinds', () => {
  it('flags passes in both Arms', () => {
    expect(
      caseSignals(item([run(true), run(true)], [run(true), run(true)]))
        .suspicious,
    ).toEqual(['passes-in-both'])
  })

  it('flags fails in both Arms', () => {
    expect(caseSignals(item([run(false)], [run(false)])).suspicious).toEqual([
      'fails-in-both',
    ])
  })

  it('flags runs that disagree within an Arm', () => {
    expect(
      caseSignals(item([run(true), run(false)], [run(false), run(false)]))
        .suspicious,
    ).toEqual(['runs-disagree'])
  })

  it('flags noise in either Arm, even when the other is clean', () => {
    expect(
      caseSignals(item([run(true), run(false)], [run(true), run(true)]))
        .suspicious,
    ).toEqual(['runs-disagree'])
    expect(
      caseSignals(item([run(true), run(true)], [run(true), run(false)]))
        .suspicious,
    ).toEqual(['runs-disagree'])
  })

  it('keeps the kinds apart: all-pass, all-fail and mixed cannot overlap', () => {
    const cases = [
      item([run(true)], [run(true)]),
      item([run(false)], [run(false)]),
      item([run(true), run(false)], [run(true), run(false)]),
    ]
    expect(cases.map((c) => caseSignals(c).suspicious.length)).toEqual([
      1, 1, 1,
    ])
  })

  it('does not flag a case that tells the Arms apart', () => {
    expect(
      caseSignals(item([run(true), run(true)], [run(false), run(false)]))
        .suspicious,
    ).toEqual([])
  })

  it('judges one Arm only on disagreement', () => {
    expect(caseSignals(item([run(true), run(true)], null)).suspicious).toEqual(
      [],
    )
    expect(caseSignals(item([run(true), run(false)], null)).suspicious).toEqual(
      ['runs-disagree'],
    )
  })

  it('flags nothing for an Arm with no runs', () => {
    expect(caseSignals(item([], [])).suspicious).toEqual([])
  })
})

describe('firedOverall', () => {
  it('sums the checked cases and ignores the unchecked', () => {
    expect(
      firedOverall([
        item([run(true, true), run(true, false)], [run(false)]),
        item([run(true)], [run(false)]),
        item([run(true, true)], [run(false)]),
      ]),
    ).toEqual({ passed: 2, total: 3 })
  })

  it('is null when no case checks it', () => {
    expect(firedOverall([item([run(true)], [run(false)])])).toBeNull()
  })
})
