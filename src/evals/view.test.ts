import { describe, expect, it } from 'vitest'
import {
  costEstimate,
  countLabel,
  erroredText,
  leftOutText,
  stoppedText,
  suspiciousText,
} from './view'

describe('countLabel', () => {
  it('shows passes over entries', () => {
    expect(countLabel({ passed: 2, total: 3 })).toBe('2/3')
    expect(countLabel({ passed: 0, total: 0 })).toBe('0/0')
  })
})

describe('costEstimate', () => {
  it('marks the CLI figure as an estimate', () => {
    expect(costEstimate(0.00265497)).toBe('about US$0.0027')
    expect(costEstimate(0.5)).toBe('about US$0.50')
    expect(costEstimate(0)).toBe('about US$0')
  })
})

describe('stoppedText', () => {
  it('adds the cost when it is known', () => {
    expect(stoppedText({ message: 'Cancelled', costUsd: 0.0015 })).toBe(
      "Cancelled. Cost about US$0.0015, the CLI's figure.",
    )
    expect(stoppedText({ message: 'Cancelled', costUsd: null })).toBe(
      'Cancelled',
    )
  })
})

describe('suspiciousText', () => {
  it('names each kind in plain words', () => {
    expect(suspiciousText('passes-in-both')).toBe(
      'passes with the Skill and without the Skill, so it does not tell them apart',
    )
    expect(suspiciousText('fails-in-both')).toContain('likely broken')
    expect(suspiciousText('runs-disagree')).toContain('noisy')
  })

  it('takes the Arm labels, for another pair of Arms', () => {
    expect(
      suspiciousText('passes-in-both', {
        first: 'in this Version',
        second: 'in the older Version',
      }),
    ).toContain('passes in this Version and in the older Version')
  })
})

describe('erroredText and leftOutText', () => {
  it('count in words', () => {
    expect(erroredText(1)).toBe('1 run ended on an error and is not counted')
    expect(erroredText(2)).toContain('2 runs')
    expect(leftOutText(1)).toContain('1 Eval has no run without the Skill')
    expect(leftOutText(3)).toContain('3 Evals have')
  })
})
