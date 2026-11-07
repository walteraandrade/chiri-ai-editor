import { describe, expect, it } from 'vitest'
import { costEstimate, countLabel, stoppedText, suspiciousText } from './view'

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
    expect(suspiciousText('passes-in-both')).toContain(
      'does not tell them apart',
    )
    expect(suspiciousText('fails-in-both')).toContain('likely broken')
    expect(suspiciousText('runs-disagree')).toContain('noisy')
  })
})
