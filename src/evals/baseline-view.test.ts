import { describe, expect, it } from 'vitest'
import { runCopy, summaryView } from './baseline-view'

const time = (at: number): string => `t${at}`
const version = { kind: 'version', versionId: 3, at: 9 } as const

describe('summaryView with no baseline', () => {
  const view = summaryView({ kind: 'none' }, time)

  it('keeps the Skill wording', () => {
    expect(view.columns).toEqual({ first: 'With', second: 'Without' })
    expect(view.comparedNote).toBeNull()
    expect(view.firedText({ passed: 2, total: 3 }, null)).toBe(
      '2/3 runs with the Skill',
    )
    expect(view.firedText(null, null)).toContain('Not checked')
    expect(
      view.helpedText({
        with: { passed: 2, total: 3 },
        without: { passed: 1, total: 3 },
        leftOut: 0,
      }),
    ).toBe('2/3 passes with, 1/3 without')
    expect(view.helpedText(null)).toBe('No run without the Skill to compare.')
    expect(view.leftOut(1)).toContain('no run without the Skill')
  })
})

describe('summaryView against a Version', () => {
  const view = summaryView(version, time)

  it("names today's SKILL.md and the Version", () => {
    expect(view.columns).toEqual({ first: 'Today', second: 'Version' })
    expect(view.labels).toEqual({
      first: "today's SKILL.md",
      second: 'the Version from t9',
    })
    expect(view.comparedNote).toBe(
      "Compared today's SKILL.md with the Version from t9. The older Stage uses today's other files, because History keeps only SKILL.md.",
    )
  })

  it('answers fired per side and helped as today against the Version', () => {
    expect(
      view.firedText({ passed: 2, total: 2 }, { passed: 1, total: 2 }),
    ).toBe("2/2 runs with today's SKILL.md, 1/2 with the Version from t9")
    expect(view.firedText({ passed: 2, total: 2 }, null)).toBe(
      "2/2 runs with today's SKILL.md",
    )
    expect(
      view.helpedText({
        with: { passed: 4, total: 4 },
        without: { passed: 2, total: 4 },
        leftOut: 0,
      }),
    ).toBe("4/4 passes with today's SKILL.md, 2/4 with the Version from t9")
    expect(view.helpedText(null)).toBe('No Eval ran in both Stages to compare.')
    expect(view.leftOut(2)).toContain('only one Stage')
  })
})

describe('runCopy', () => {
  it('has no Stage note or titles without a Version', () => {
    const copy = runCopy('none')
    expect(copy.stageNote).toBeNull()
    expect(copy.todayTitle).toBeNull()
    expect(copy.intro(1, '2.1.319')).toBe(
      '1 Eval, each run with and without the Skill, by the real agent through Claude CLI 2.1.319.',
    )
  })

  it("says the older Stage uses today's other files and how the limit is shared", () => {
    const copy = runCopy('version')
    expect(copy.stageNote).toContain("today's other files")
    expect(copy.limitNote).toContain('both runs')
    expect(copy.olderTitle).toBe("The Version's Stage")
    expect(copy.intro(2, 'x')).toContain('2 Evals')
  })
})
