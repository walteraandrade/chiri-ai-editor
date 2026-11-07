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
            runs: {
              with: [{ passed: true, fired: null, errored: false }],
              without: [{ passed: false, fired: null, errored: false }],
            },
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

  it('records per run whether a tool_used Skill grader passed', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        const item = firstCase(report) as CaseDraft & {
          graders: unknown[]
        }
        item.graders.push({
          name: 'skill-fired',
          type: 'tool_used',
          config: { tool: 'Skill' },
        })
        const run = item.arms.with[0] as Entry & { graders: unknown[] }
        run.graders.push({ name: 'skill-fired', passed: true })
        const bare = structuredClone(run)
        bare.graders = [{ name: 'skill-fired', passed: false }]
        item.arms.with.push(bare)
      }),
    )
    expect(
      outcome.kind === 'complete' && outcome.summary.cases[0]?.runs.with,
    ).toEqual([
      { passed: true, fired: true, errored: false },
      { passed: true, fired: false, errored: false },
    ])
    expect(
      outcome.kind === 'complete' && outcome.summary.cases[0]?.runs.without,
    ).toEqual([{ passed: false, fired: null, errored: false }])
  })

  it('does not count a tool_used grader on another tool as firing', () => {
    const outcome = parseEvalReport(
      withEdit('with-without.json', (report) => {
        const item = firstCase(report) as CaseDraft & { graders: unknown[] }
        item.graders.push({
          name: 'read',
          type: 'tool_used',
          config: { tool: 'Read' },
        })
      }),
    )
    expect(
      outcome.kind === 'complete' && outcome.summary.cases[0]?.runs.with,
    ).toEqual([{ passed: true, fired: null, errored: false }])
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

  describe('the fired indicator', () => {
    const firedWith = (
      grader: Record<string, unknown>,
      skillName = 'fx-skill',
    ) => {
      const outcome = parseEvalReport(
        withEdit('with-without.json', (report) => {
          const suite = report.suite as { plugins: { name: string }[] }
          suite.plugins = [{ name: skillName }]
          const item = firstCase(report) as CaseDraft & { graders: unknown[] }
          item.graders.push({ name: 'indicator', type: 'tool_used', ...grader })
          const run = item.arms.with[0] as Entry & { graders: unknown[] }
          run.graders.push({ name: 'indicator', passed: true })
        }),
      )
      return outcome.kind === 'complete'
        ? outcome.summary.cases[0]?.runs.with[0]?.fired
        : undefined
    }

    it('ignores a must-not-invoke check', () => {
      expect(
        firedWith({ config: { tool: 'Skill', min: 0, max: 0 } }),
      ).toBeNull()
    })

    it('needs input_match to name this Skill, with or without a plugin prefix', () => {
      const match = '"skill"\\s*:\\s*"(?:[\\w-]+:)?fx-skill"'
      expect(firedWith({ config: { tool: 'Skill', input_match: match } })).toBe(
        true,
      )
      expect(
        firedWith({
          config: { tool: 'Skill', input_match: '"skill":"fx-skill:fx-skill"' },
        }),
      ).toBe(true)
    })

    it('ignores a Skill grader that matches another Skill', () => {
      expect(
        firedWith({
          config: { tool: 'Skill', input_match: '"skill"\\s*:\\s*"other"' },
        }),
      ).toBeNull()
    })
  })

  describe('runs that ended on an error', () => {
    const outcomeWith = (edit: (entry: Entry) => void) => {
      const outcome = parseEvalReport(
        withEdit('with-without.json', (report) => {
          edit(firstCase(report).arms.with[0] as Entry)
        }),
      )
      return outcome.kind === 'complete' ? outcome.summary.cases[0] : undefined
    }

    it('leaves out a run that scored 0 without grading', () => {
      const item = outcomeWith((entry) => {
        entry.error = 'API Error: 429'
        entry.passed = false
        entry.graders = []
      })
      expect(item?.with).toEqual({ passed: 0, total: 0 })
      expect(item?.runs.with[0]?.errored).toBe(true)
    })

    it('keeps a run with an error that was still graded', () => {
      const item = outcomeWith((entry) => {
        entry.error = 'timed out after 300s'
      })
      expect(item?.with).toEqual({ passed: 1, total: 1 })
      expect(item?.runs.with[0]?.errored).toBe(false)
    })
  })
})
