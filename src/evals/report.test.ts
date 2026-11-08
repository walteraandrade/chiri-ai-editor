import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEvalReport } from './report'

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

type Entry = { passed: boolean; [key: string]: unknown }

type CaseDraft = {
  name: string
  runsPerCase: number
  arms: { with: Entry[]; without?: Entry[] }
}

type Draft = {
  schemaVersion: number
  cases: CaseDraft[]
  [key: string]: unknown
}

const firstCase = (report: Draft): CaseDraft => report.cases[0] as CaseDraft

const withEdit = (name: string, edit: (report: Draft) => void): string => {
  const report = JSON.parse(fixture(name)) as Draft
  edit(report)
  return JSON.stringify(report)
}

describe('parseEvalReport', () => {
  it('counts passes per Arm from the entries of a complete run', () => {
    const outcome = parseEvalReport(fixture('with-without.json'))
    expect(outcome).toEqual({
      kind: 'complete',
      summary: {
        claudeVersion: '2.1.319',
        startedAt: '2026-11-07T20:03:24.309Z',
        costUsd: 0.00265497,
        cases: [
          {
            name: 'greet',
            with: { passed: 1, total: 1 },
            without: { passed: 0, total: 1 },
          },
        ],
        with: { passed: 1, total: 1 },
        without: { passed: 0, total: 1 },
      },
    })
  })

  it('counts entries, not runsPerCase', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        firstCase(report).runsPerCase = 3
      }),
    )
    expect(outcome.kind === 'complete' && outcome.summary.with.total).toBe(1)
  })

  it('sums several cases and runs', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        const first = firstCase(report)
        const failing = structuredClone(first.arms.with[0] as Entry)
        failing.passed = false
        first.arms.with.push(
          failing,
          structuredClone(first.arms.with[0] as Entry),
        )
        report.cases.push({ ...structuredClone(first), name: 'second' })
      }),
    )
    expect(outcome.kind === 'complete' && outcome.summary.with).toEqual({
      passed: 4,
      total: 6,
    })
    expect(
      outcome.kind === 'complete' && outcome.summary.cases[0]?.with,
    ).toEqual({ passed: 2, total: 3 })
  })

  it('has no without Arm when the run had a single one', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        delete firstCase(report).arms.without
      }),
    )
    expect(outcome.kind === 'complete' && outcome.summary.without).toBeNull()
  })

  it('ignores fields it does not know', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        const entry = firstCase(report).arms.with[0] as Entry
        report.somethingNew = { a: 1 }
        entry.extra = true
      }),
    )
    expect(outcome.kind).toBe('complete')
  })

  it('shows no pass for a partial run', () => {
    const outcome = parseEvalReport(fixture('auth-failed.json'))
    expect(outcome).toEqual({
      kind: 'partial',
      reason: 'auth_failed',
      claudeVersion: '2.1.319',
    })
  })

  it('refuses another schemaVersion, naming the CLI version', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        report.schemaVersion = 2
      }),
    )
    expect(outcome.kind).toBe('refused')
    expect(outcome.kind === 'refused' && outcome.message).toContain('2.1.319')
  })

  it('refuses a report that does not parse', () => {
    expect(parseEvalReport('{not json').kind).toBe('refused')
    expect(parseEvalReport('[]').kind).toBe('refused')
  })

  it('refuses a version 1 report with the wrong shape', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        report.cases = 'none' as unknown as CaseDraft[]
      }),
    )
    expect(outcome.kind === 'refused' && outcome.message).toContain('2.1.319')
  })
})
