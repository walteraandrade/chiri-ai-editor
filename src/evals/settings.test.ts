import { describe, expect, it } from 'vitest'
import { checkEvalSettings, DEFAULT_EVAL_SETTINGS } from './settings'

describe('checkEvalSettings', () => {
  it('accepts the defaults', () => {
    expect(checkEvalSettings(DEFAULT_EVAL_SETTINGS)).toEqual([])
  })

  it.each([0, 6, 1.5, Number.NaN])('refuses runs %s', (runs) => {
    expect(checkEvalSettings({ ...DEFAULT_EVAL_SETTINGS, runs })).not.toEqual(
      [],
    )
  })

  it.each(['--allow-tools', '', '1haiku', 'a b', 'a=b', '-x', 'a/b'])(
    'refuses model %j',
    (model) => {
      expect(
        checkEvalSettings({ ...DEFAULT_EVAL_SETTINGS, model }),
      ).not.toEqual([])
    },
  )

  it.each(['haiku', 'sonnet', 'claude-haiku-4.5'])(
    'accepts model %s',
    (model) => {
      expect(checkEvalSettings({ ...DEFAULT_EVAL_SETTINGS, model })).toEqual([])
    },
  )

  it.each([0, -1, 5.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a cost limit of %s',
    (maxCostUsd) => {
      expect(
        checkEvalSettings({ ...DEFAULT_EVAL_SETTINGS, maxCostUsd }),
      ).not.toEqual([])
    },
  )

  it('accepts a cost limit of 5', () => {
    expect(
      checkEvalSettings({ ...DEFAULT_EVAL_SETTINGS, maxCostUsd: 5 }),
    ).toEqual([])
  })
})
