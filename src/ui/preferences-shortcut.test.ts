import { describe, expect, it } from 'vitest'
import { isPreferencesShortcut } from './preferences-shortcut'

const press = (init: Partial<KeyboardEvent>) =>
  ({
    key: ',',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  }) as KeyboardEvent

describe('isPreferencesShortcut', () => {
  it('accepts Ctrl+comma and Cmd+comma', () => {
    expect(isPreferencesShortcut(press({ ctrlKey: true }))).toBe(true)
    expect(isPreferencesShortcut(press({ metaKey: true }))).toBe(true)
  })

  it('ignores a bare comma and other modifiers', () => {
    expect(isPreferencesShortcut(press({}))).toBe(false)
    expect(
      isPreferencesShortcut(press({ ctrlKey: true, shiftKey: true })),
    ).toBe(false)
    expect(isPreferencesShortcut(press({ ctrlKey: true, altKey: true }))).toBe(
      false,
    )
  })

  it('ignores other keys', () => {
    expect(isPreferencesShortcut(press({ ctrlKey: true, key: '.' }))).toBe(
      false,
    )
  })
})
