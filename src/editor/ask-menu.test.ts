import { describe, expect, it } from 'vitest'
import { getQuickAction, type QuickAction } from '../ai/quick-actions'
import {
  type AskMenu,
  askHint,
  askRows,
  chosenRow,
  EMPTY_ASK_MENU,
  hintVisible,
  hoverAskMenu,
  moveAskMenu,
  typeAskMenu,
} from './ask-menu'

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

  it('ignores browsing once there is a query', () => {
    expect(labels('sh', true)).toEqual(['Shorter', 'free: sh'])
  })

  it('matches the start of a label case-insensitively and ends with the free text', () => {
    expect(labels('SH')).toEqual(['Shorter', 'free: SH'])
  })

  it('matches the start of any word, not the middle of one', () => {
    expect(labels('gram')).toEqual(['Fix grammar', 'free: gram'])
    expect(labels('r')).toEqual(['free: r'])
  })

  it('puts label starts before word starts, keeping list order within each', () => {
    const actions = [
      getQuickAction('more-formal'),
      getQuickAction('cut-known'),
      getQuickAction('fix-grammar'),
      getQuickAction('make-instruction'),
    ]
    expect(
      askRows(actions, 'm', false).map((row) =>
        row.kind === 'action' ? row.action.id : row.kind,
      ),
    ).toEqual(['more-formal', 'make-instruction', 'free'])
    expect(
      askRows(actions, 'a', false).map((row) =>
        row.kind === 'action' ? row.action.id : row.kind,
      ),
    ).toEqual(['cut-known', 'make-instruction', 'free'])
  })

  it('falls back to free text when nothing matches', () => {
    expect(labels('shorter please')).toEqual(['free: shorter please'])
  })

  it('marks the matched span of each label', () => {
    const label = getQuickAction('cut-known').label
    const [row] = askRows(ACTIONS, ' agent ', false)
    expect(row).toEqual({
      kind: 'action',
      action: getQuickAction('cut-known'),
      match: {
        from: label.indexOf('agent'),
        to: label.indexOf('agent') + 'agent'.length,
      },
    })
  })

  it('trims the free text', () => {
    expect(askRows(ACTIONS, '  tone only ', false).at(-1)).toEqual({
      kind: 'free',
      text: 'tone only',
    })
  })
})

describe('ask menu state', () => {
  const typed = (query: string): AskMenu => typeAskMenu(query)

  it('starts at rest with the hint visible', () => {
    expect(chosenRow(ACTIONS, EMPTY_ASK_MENU)).toBeUndefined()
    expect(hintVisible(EMPTY_ASK_MENU)).toBe(true)
  })

  it('chooses the first row after typing, and hides the hint', () => {
    expect(chosenRow(ACTIONS, typed('cl'))).toMatchObject({
      kind: 'action',
      action: { id: 'clearer' },
    })
    expect(hintVisible(typed('cl'))).toBe(false)
    expect(hintVisible(typed(' '))).toBe(false)
  })

  it('opens every action on a move from an empty query', () => {
    const browsing = moveAskMenu(ACTIONS, EMPTY_ASK_MENU, -1)
    expect(browsing).toEqual({ query: '', browsing: true, active: 0 })
    expect(hintVisible(browsing)).toBe(false)
  })

  it('wraps moves at both ends', () => {
    const menu = typed('c')
    expect(moveAskMenu(ACTIONS, menu, -1).active).toBe(2)
    expect(moveAskMenu(ACTIONS, { ...menu, active: 2 }, 1).active).toBe(0)
  })

  it('resets the browsing and the highlight on typing', () => {
    expect(typeAskMenu('f')).toEqual({ query: 'f', browsing: false, active: 0 })
  })

  it('chooses the free text when nothing matches', () => {
    expect(chosenRow(ACTIONS, typed('tone only'))).toEqual({
      kind: 'free',
      text: 'tone only',
    })
  })

  it('follows the pointer', () => {
    expect(chosenRow(ACTIONS, hoverAskMenu(typed('c'), 2))).toEqual({
      kind: 'free',
      text: 'c',
    })
  })

  it('does nothing on a move without actions or rows', () => {
    expect(moveAskMenu([], EMPTY_ASK_MENU, 1)).toEqual({
      query: '',
      browsing: true,
      active: 0,
    })
    expect(chosenRow([], moveAskMenu([], EMPTY_ASK_MENU, 1))).toBeUndefined()
    expect(moveAskMenu(ACTIONS, typed(' '), 1)).toEqual(typed(' '))
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
