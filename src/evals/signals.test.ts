import { describe, expect, it } from 'vitest'
import type { CaseTally, RunRecord } from './report'
import { caseSignals, firedOverall, helpedOverall, signalsOf } from './signals'
import { armTally } from './tally'

const run = (
  passed: boolean,
  fired: boolean | null = null,
  errored = false,
): RunRecord => ({ passed, fired, errored })

const item = (
  withRuns: readonly RunRecord[],
  withoutRuns: readonly RunRecord[] | null,
  name = 'case',
): CaseTally => ({
  name,
  with: armTally(withRuns),
  without: withoutRuns === null ? null : armTally(withoutRuns),
  runs: { with: withRuns, without: withoutRuns },
})

describe('fired', () => {
  it('counts the runs in the Arm with the Skill where it fired', () => {
    expect(
      caseSignals(
        item(
          [run(true, true), run(true, false), run(false, true)],
          [run(false)],
        ),
      ).fired,
    ).toEqual({ passed: 2, total: 3 })
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

  it('leaves out runs that ended on an error', () => {
    expect(
      caseSignals(item([run(false, false, true), run(true, true)], null)).fired,
    ).toEqual({ passed: 1, total: 1 })
  })
})

describe('errored runs', () => {
  it('counts them across both Arms and keeps them out of Suspicious', () => {
    const signals = caseSignals(
      item([run(true), run(false, null, true)], [run(true), run(true)]),
    )
    expect(signals.errored).toBe(1)
    expect(signals.suspicious).toEqual(['passes-in-both'])
    expect(
      caseSignals(item([run(false, null, true)], [run(false, null, true)]))
        .suspicious,
    ).toEqual([])
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

describe('signalsOf', () => {
  it('works on any pair of Arms, not only with and without the Skill', () => {
    const signals = signalsOf(
      'older',
      [run(true), run(true)],
      [run(true), run(true)],
    )
    expect(signals.name).toBe('older')
    expect(signals.suspicious).toEqual(['passes-in-both'])
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

describe('helpedOverall', () => {
  it('compares only the cases that have both Arms and counts the rest', () => {
    expect(
      helpedOverall([
        item([run(true), run(true)], [run(false), run(true)]),
        item([run(true)], null),
      ]),
    ).toEqual({
      with: { passed: 2, total: 2 },
      without: { passed: 1, total: 2 },
      leftOut: 1,
    })
  })

  it('is null when no case has a second Arm', () => {
    expect(helpedOverall([item([run(true)], null)])).toBeNull()
  })
})
