import { describe, expect, it } from 'vitest'
import { isLibraryShortcut, libraryKeyAnswer } from './library-fold'

describe('libraryKeyAnswer', () => {
  it('opens and focuses a folded Library', () => {
    expect(libraryKeyAnswer({ open: false, focused: false })).toBe(
      'open-and-focus',
    )
  })

  it('focuses the tree of an open Library when the focus is elsewhere', () => {
    expect(libraryKeyAnswer({ open: true, focused: false })).toBe('focus')
  })

  it('folds an open, focused Library and returns to the text', () => {
    expect(libraryKeyAnswer({ open: true, focused: true })).toBe(
      'fold-and-return',
    )
  })

  it('opens a folded Library even if a stale focus flag is set', () => {
    expect(libraryKeyAnswer({ open: false, focused: true })).toBe(
      'open-and-focus',
    )
  })
})

const press = (init: Partial<KeyboardEvent>) =>
  ({
    key: 'b',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...init,
  }) as KeyboardEvent

describe('isLibraryShortcut', () => {
  it('accepts Ctrl+B off Apple platforms', () => {
    expect(isLibraryShortcut(press({ ctrlKey: true }), false)).toBe(true)
    expect(isLibraryShortcut(press({ ctrlKey: true, key: 'B' }), false)).toBe(
      true,
    )
  })

  it('accepts Cmd+B on Apple platforms only', () => {
    expect(isLibraryShortcut(press({ metaKey: true }), true)).toBe(true)
    expect(isLibraryShortcut(press({ metaKey: true }), false)).toBe(false)
  })

  it('leaves Ctrl+B to the text on Apple platforms', () => {
    expect(isLibraryShortcut(press({ ctrlKey: true }), true)).toBe(false)
  })

  it('ignores a bare B, other modifiers and other keys', () => {
    expect(isLibraryShortcut(press({}), false)).toBe(false)
    expect(
      isLibraryShortcut(press({ ctrlKey: true, shiftKey: true }), false),
    ).toBe(false)
    expect(
      isLibraryShortcut(press({ ctrlKey: true, altKey: true }), false),
    ).toBe(false)
    expect(isLibraryShortcut(press({ ctrlKey: true, key: 'p' }), false)).toBe(
      false,
    )
  })
})
