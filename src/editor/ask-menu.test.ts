import { describe, expect, it } from 'vitest'
import { getQuickAction, type QuickAction } from '../ai/quick-actions'
import { askHint, askRows } from './ask-menu'

const ACTIONS: readonly QuickAction[] = [
  getQuickAction('shorter'),
  getQuickAction('clearer'),
  getQuickAction('fix-grammar'),
  getQuickAction('cut-known'),
]

const labels = (query: string, browsing = false) =>
  askRows(ACTIONS, query, browsing).map((row) =>
    row.kind === 'action' ? row.action.label : `free: ${row.text}`,
  )

describe('askRows', () => {
  it('shows nothing for an empty query', () => {
    expect(askRows(ACTIONS, '', false)).toEqual([])
    expect(askRows(ACTIONS, '   ', false)).toEqual([])
  })

  it('lists every action, without free text, when browsing an empty query', () => {
    expect(labels('', true)).toEqual([
      'Shorter',
      'Clearer',
      'Fix grammar',
      'Cut what the agent already knows',
    ])
  })

  it('matches labels case-insensitively and ends with the free text', () => {
    expect(labels('SH')).toEqual(['Shorter', 'free: SH'])
  })

  it('puts label prefixes before matches inside a label', () => {
    const actions = [
      getQuickAction('more-formal'),
      getQuickAction('fix-grammar'),
    ]
    expect(
      askRows(actions, 'f', false).map((row) =>
        row.kind === 'action' ? row.action.id : row.kind,
      ),
    ).toEqual(['fix-grammar', 'more-formal', 'free'])
  })

  it('falls back to free text when nothing matches', () => {
    expect(labels('shorter please')).toEqual(['free: shorter please'])
  })

  it('marks the matched span of each label', () => {
    const [row] = askRows(ACTIONS, ' agent ', false)
    expect(row).toEqual({
      kind: 'action',
      action: getQuickAction('cut-known'),
      match: { from: 13, to: 18 },
    })
  })

  it('trims the free text', () => {
    expect(askRows(ACTIONS, '  tone only ', false).at(-1)).toEqual({
      kind: 'free',
      text: 'tone only',
    })
  })
})

describe('askHint', () => {
  it('names the first action', () => {
    expect(askHint(ACTIONS)).toBe('Try “shorter”, or press ↓ for all actions')
  })

  it('is empty without actions', () => {
    expect(askHint([])).toBeUndefined()
  })
})
