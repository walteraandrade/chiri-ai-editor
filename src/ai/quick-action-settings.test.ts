import { describe, expect, it } from 'vitest'
import {
  addUserQuickAction,
  checkQuickActionDraft,
  DEFAULT_QUICK_ACTION_SETTINGS,
  enabledQuickActions,
  moveQuickAction,
  parseQuickActionSettings,
  type QuickActionSettings,
  removeUserQuickAction,
  serializeQuickActionSettings,
  toggleQuickAction,
  updateUserQuickAction,
} from './quick-action-settings'
import { QUICK_ACTIONS } from './quick-actions'

const ids = (settings: QuickActionSettings) =>
  settings.map((slot) => slot.action.id)

const onIds = (settings: QuickActionSettings) =>
  enabledQuickActions(settings).map((action) => action.id)

const DRAFT = {
  label: 'Warmer',
  instruction: 'Make the tone warmer.',
  skillOnly: false,
}

const withWarmer = addUserQuickAction(
  DEFAULT_QUICK_ACTION_SETTINGS,
  DRAFT,
  'user-1',
)

describe('default Quick action settings', () => {
  it('lists every built-in action, with Shorter, Clearer and Fix grammar on first', () => {
    expect(ids(DEFAULT_QUICK_ACTION_SETTINGS)).toEqual([
      'shorter',
      'clearer',
      'fix-grammar',
      'more-formal',
      'make-instruction',
      'cut-known',
    ])
    expect(onIds(DEFAULT_QUICK_ACTION_SETTINGS)).toEqual([
      'shorter',
      'clearer',
      'fix-grammar',
    ])
  })
})

describe('enabledQuickActions', () => {
  it('keeps the order and drops skill actions outside a skill', () => {
    const settings = toggleQuickAction(
      toggleQuickAction(DEFAULT_QUICK_ACTION_SETTINGS, 'cut-known', true),
      'shorter',
      false,
    )
    expect(onIds(settings)).toEqual(['clearer', 'fix-grammar', 'cut-known'])
    expect(
      enabledQuickActions(settings, false).map((action) => action.id),
    ).toEqual(['clearer', 'fix-grammar'])
  })
})

describe('moveQuickAction', () => {
  it('moves an action up or down one place', () => {
    expect(
      ids(moveQuickAction(DEFAULT_QUICK_ACTION_SETTINGS, 'clearer', -1)),
    ).toEqual([
      'clearer',
      'shorter',
      'fix-grammar',
      'more-formal',
      'make-instruction',
      'cut-known',
    ])
    expect(
      ids(moveQuickAction(DEFAULT_QUICK_ACTION_SETTINGS, 'clearer', 1)).slice(
        0,
        3,
      ),
    ).toEqual(['shorter', 'fix-grammar', 'clearer'])
  })

  it('leaves the list alone at either end', () => {
    expect(moveQuickAction(DEFAULT_QUICK_ACTION_SETTINGS, 'shorter', -1)).toBe(
      DEFAULT_QUICK_ACTION_SETTINGS,
    )
    expect(moveQuickAction(DEFAULT_QUICK_ACTION_SETTINGS, 'cut-known', 1)).toBe(
      DEFAULT_QUICK_ACTION_SETTINGS,
    )
  })
})

describe('user Quick actions', () => {
  it('adds a new action at the end, turned on, with trimmed text', () => {
    const settings = addUserQuickAction(
      DEFAULT_QUICK_ACTION_SETTINGS,
      { label: '  Warmer ', instruction: ' Make it warm. ', skillOnly: true },
      'user-1',
    )
    expect(settings.at(-1)).toEqual({
      on: true,
      action: {
        id: 'user-1',
        label: 'Warmer',
        instruction: 'Make it warm.',
        skillOnly: true,
      },
    })
  })

  it('edits a user action in place and keeps whether it is on', () => {
    const off = toggleQuickAction(withWarmer, 'user-1', false)
    const edited = updateUserQuickAction(off, 'user-1', {
      label: 'Kinder',
      instruction: 'Be kind.',
      skillOnly: false,
    })
    expect(edited.at(-1)).toEqual({
      on: false,
      action: {
        id: 'user-1',
        label: 'Kinder',
        instruction: 'Be kind.',
        skillOnly: false,
      },
    })
  })

  it('never edits or deletes a built-in action', () => {
    expect(updateUserQuickAction(withWarmer, 'user-2', DRAFT)).toBe(withWarmer)
    expect(ids(removeUserQuickAction(withWarmer, 'user-1'))).toEqual(
      ids(DEFAULT_QUICK_ACTION_SETTINGS),
    )
  })
})

describe('checkQuickActionDraft', () => {
  it('accepts a label and an Instruction', () => {
    expect(
      checkQuickActionDraft(withWarmer, { ...DRAFT, label: 'Bolder' }),
    ).toEqual({})
  })

  it('asks for a label and an Instruction', () => {
    expect(
      checkQuickActionDraft(withWarmer, {
        label: ' ',
        instruction: '',
        skillOnly: false,
      }),
    ).toEqual({ label: 'Give it a name.', instruction: 'Say what to do.' })
  })

  it('refuses a name another action already has, ignoring case', () => {
    expect(
      checkQuickActionDraft(withWarmer, { ...DRAFT, label: 'shorter' }),
    ).toEqual({ label: 'Another Quick action has this name.' })
    expect(
      checkQuickActionDraft(withWarmer, { ...DRAFT, label: 'WARMER' }),
    ).toEqual({ label: 'Another Quick action has this name.' })
  })

  it('lets an action keep its own name while it is edited', () => {
    expect(checkQuickActionDraft(withWarmer, DRAFT, 'user-1')).toEqual({})
  })

  it('caps the label and the Instruction', () => {
    expect(
      checkQuickActionDraft(withWarmer, {
        label: 'x'.repeat(41),
        instruction: 'y'.repeat(2001),
        skillOnly: false,
      }),
    ).toEqual({
      label: 'Use at most 40 characters.',
      instruction: 'Use at most 2000 characters.',
    })
  })
})

describe('stored Quick action settings', () => {
  it('round-trips, storing only the id of a built-in action', () => {
    const text = serializeQuickActionSettings(withWarmer)
    expect(JSON.parse(text).actions[0]).toEqual({ id: 'shorter', on: true })
    expect(parseQuickActionSettings(text)).toEqual(withWarmer)
  })

  it('takes built-in wording from the app, not the file', () => {
    const text = JSON.stringify({
      version: 1,
      actions: [
        { id: 'shorter', on: false, label: 'Hacked', instruction: 'x' },
      ],
    })
    const parsed = parseQuickActionSettings(text)
    expect(parsed?.[0]).toEqual({ on: false, action: QUICK_ACTIONS[0] })
  })

  it('adds built-in actions the file misses, turned off, and drops unknown or repeated ones', () => {
    const text = JSON.stringify({
      version: 1,
      actions: [
        { id: 'clearer', on: true },
        { id: 'clearer', on: false },
        { id: 'retired', on: true },
        { id: 'user-9', on: true, label: '', instruction: 'x' },
      ],
    })
    const parsed = parseQuickActionSettings(text)
    expect(parsed && ids(parsed)).toEqual([
      'clearer',
      'shorter',
      'more-formal',
      'fix-grammar',
      'make-instruction',
      'cut-known',
    ])
    expect(parsed && onIds(parsed)).toEqual(['clearer'])
  })

  it('renames a user action whose name a built-in action now has, instead of losing it', () => {
    const text = JSON.stringify({
      version: 1,
      actions: [
        { id: 'user-1', on: true, label: 'Shorter', instruction: 'x' },
        { id: 'user-2', on: true, label: 'shorter', instruction: 'y' },
      ],
    })
    const parsed = parseQuickActionSettings(text)
    const user = parsed?.filter((slot) => slot.action.id.startsWith('user-'))
    expect(user?.map((slot) => slot.action.label)).toEqual(['Shorter (mine)'])
  })

  it('reads nothing from text that is not version 1 settings', () => {
    expect(parseQuickActionSettings('not json')).toBeNull()
    expect(parseQuickActionSettings('{"version":2,"actions":[]}')).toBeNull()
    expect(parseQuickActionSettings('{"version":1}')).toBeNull()
  })
})
