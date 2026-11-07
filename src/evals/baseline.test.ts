import { describe, expect, it } from 'vitest'
import type { VersionSummary } from '../history/types'
import {
  parseSummaryBaseline,
  TODAY_LABEL,
  versionLabel,
  versionOptionLabel,
} from './baseline'

const edited: VersionSummary = {
  id: 2,
  at: 1000,
  cause: { kind: 'edited' },
  words: 10,
  wordsAdded: 3,
  wordsRemoved: 0,
}

describe('parseSummaryBaseline', () => {
  it('reads no baseline and a Version with its time', () => {
    expect(parseSummaryBaseline('{"kind":"none"}')).toEqual({ kind: 'none' })
    expect(
      parseSummaryBaseline('{"kind":"version","versionId":4,"at":99}'),
    ).toEqual({ kind: 'version', versionId: 4, at: 99 })
  })

  it('refuses anything else', () => {
    expect(parseSummaryBaseline('nope')).toBeNull()
    expect(parseSummaryBaseline('{"kind":"version","versionId":4}')).toBeNull()
    expect(parseSummaryBaseline('{"kind":"none","x":1}')).toBeNull()
    expect(parseSummaryBaseline('{"kind":"other"}')).toBeNull()
  })
})

describe('labels', () => {
  it('describes a Version as the Timeline does, with its time', () => {
    expect(versionOptionLabel([edited], edited, (at) => `t${at}`)).toBe(
      't1000 · You: You added 3 words',
    )
  })

  it('names both sides of the comparison', () => {
    expect(TODAY_LABEL).toBe("today's SKILL.md")
    expect(versionLabel(5, (at) => `t${at}`)).toBe('the Version from t5')
  })
})
