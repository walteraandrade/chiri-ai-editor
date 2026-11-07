import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapRunOutcome, type OutcomeInput } from './outcome'

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

const withReason = (reason: string | null): string =>
  JSON.stringify({
    ...JSON.parse(fixture('auth-failed.json')),
    partial: true,
    partialReason: reason,
  })

const noCases = JSON.stringify({
  ...JSON.parse(fixture('with-without.json')),
  cases: [],
})

const input = (overrides: Partial<OutcomeInput>): OutcomeInput => ({
  reportText: fixture('with-without.json'),
  exitCode: 0,
  signal: null,
  cancelled: false,
  maxCostUsd: 0.3,
  ...overrides,
})

const message = (overrides: Partial<OutcomeInput>): string | null => {
  const outcome = mapRunOutcome(input(overrides))
  return outcome.kind === 'not-complete' ? outcome.message : null
}

describe('mapRunOutcome', () => {
  it('completes on exit 0 with a complete report', () => {
    expect(mapRunOutcome(input({})).kind).toBe('complete')
  })

  it('completes on exit 1 with a complete report', () => {
    expect(mapRunOutcome(input({ exitCode: 1 })).kind).toBe('complete')
  })

  it('says Cancelled for partialReason interrupted', () => {
    expect(
      message({ reportText: withReason('interrupted'), exitCode: 130 }),
    ).toBe('Cancelled')
  })

  it('says Cancelled for exit 130 or 143 with a partial report of another reason', () => {
    expect(message({ reportText: withReason(null), exitCode: 130 })).toBe(
      'Cancelled',
    )
    expect(message({ reportText: withReason('x'), exitCode: 143 })).toBe(
      'Cancelled',
    )
  })

  it('says Cancelled for exit 130 or 143 without a report', () => {
    expect(message({ reportText: null, exitCode: 143 })).toBe('Cancelled')
    expect(message({ reportText: null, exitCode: 130 })).toBe('Cancelled')
  })

  it('says Cancelled when the child died of SIGTERM or SIGINT', () => {
    expect(
      message({ reportText: null, exitCode: null, signal: 'SIGTERM' }),
    ).toBe('Cancelled')
    expect(
      message({ reportText: null, exitCode: null, signal: 'SIGINT' }),
    ).toBe('Cancelled')
  })

  it('says Cancelled for a user cancel, over every other signal', () => {
    expect(message({ cancelled: true })).toBe('Cancelled')
    expect(
      message({
        cancelled: true,
        reportText: withReason('auth_failed'),
        exitCode: 2,
      }),
    ).toBe('Cancelled')
    expect(message({ cancelled: true, reportText: null, exitCode: 2 })).toBe(
      'Cancelled',
    )
  })

  it('names the cost limit', () => {
    const cost = withReason('cost_ceiling')
    expect(message({ reportText: cost, exitCode: 2 })).toBe(
      'Stopped at the cost limit (US$0.30)',
    )
    expect(message({ reportText: cost, exitCode: 2, maxCostUsd: 1 })).toBe(
      'Stopped at the cost limit (US$1.00)',
    )
    expect(message({ reportText: cost, exitCode: 2, maxCostUsd: 0.125 })).toBe(
      'Stopped at the cost limit (US$0.125)',
    )
  })

  it('says Claude is not logged in', () => {
    expect(
      message({ reportText: withReason('auth_failed'), exitCode: 2 }),
    ).toBe('Claude is not logged in')
  })

  it('lets partialReason win over the exit code', () => {
    expect(
      message({ reportText: withReason('auth_failed'), exitCode: 130 }),
    ).toBe('Claude is not logged in')
    expect(
      message({ reportText: withReason('cost_ceiling'), exitCode: 1 }),
    ).toBe('Stopped at the cost limit (US$0.30)')
  })

  it('does not guess the reason for exit 2 without a report', () => {
    expect(message({ reportText: null, exitCode: 2 })).toBe(
      'Claude exited with code 2 before it wrote a report',
    )
  })

  it('does not guess for a partial report of unknown reason', () => {
    expect(message({ reportText: withReason('new_reason'), exitCode: 2 })).toBe(
      'Claude stopped early (new_reason) with exit code 2',
    )
    expect(message({ reportText: withReason(null), exitCode: 2 })).toBe(
      'Claude stopped early with exit code 2',
    )
  })

  it('gives the Adapter message with the CLI version for another schemaVersion', () => {
    const text = JSON.stringify({
      ...JSON.parse(fixture('with-without.json')),
      schemaVersion: 2,
    })
    expect(message({ reportText: text })).toBe(
      'The Eval report has schemaVersion 2, which this app does not read (Claude CLI 2.1.319)',
    )
  })

  it('gives the Adapter message for unparsable JSON', () => {
    expect(message({ reportText: 'not json' })).toBe(
      'The Eval report could not be read (an unknown Claude CLI version)',
    )
  })

  it('says No Evals in this skill for exit 1 and no cases', () => {
    expect(message({ reportText: noCases, exitCode: 1 })).toBe(
      'No Evals in this skill',
    )
  })

  it('does not call a complete report with an unexpected exit code complete', () => {
    expect(message({ exitCode: 3 })).toBe('Claude exited with code 3')
  })

  it('names the signal when there is no report and no exit code', () => {
    expect(
      message({ reportText: null, exitCode: null, signal: 'SIGKILL' }),
    ).toBe('Claude stopped with SIGKILL')
  })

  it('never carries a summary for a cancelled run', () => {
    expect(
      mapRunOutcome(
        input({ reportText: withReason('interrupted'), exitCode: 130 }),
      ),
    ).toEqual({ kind: 'not-complete', message: 'Cancelled' })
  })
})
