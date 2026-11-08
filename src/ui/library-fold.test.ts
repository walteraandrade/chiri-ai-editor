import { describe, expect, it } from 'vitest'
import {
  ECHO_WINDOW_MS,
  isEchoOfKey,
  isLibraryShortcut,
  isModalOpen,
  isSearchShortcut,
  libraryKeyAnswer,
  railAnswer,
} from './library-fold'

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

describe('railAnswer', () => {
  it('folds an open Library whatever holds the focus', () => {
    expect(railAnswer(true)).toBe('fold-and-return')
  })

  it('opens a folded Library and focuses the tree', () => {
    expect(railAnswer(false)).toBe('open-and-focus')
  })
})

describe('isEchoOfKey', () => {
  it('is an echo within the window after a handled key', () => {
    expect(isEchoOfKey(1000, 1000 + ECHO_WINDOW_MS - 1)).toBe(true)
  })

  it('is not an echo later, or with no key before', () => {
    expect(isEchoOfKey(1000, 1000 + ECHO_WINDOW_MS)).toBe(false)
    expect(isEchoOfKey(null, 1000)).toBe(false)
  })
})

describe('isModalOpen', () => {
  it('sees an open dialog', () => {
    expect(isModalOpen({ querySelector: () => ({}) as Element })).toBe(true)
    expect(isModalOpen({ querySelector: () => null })).toBe(false)
  })
})

describe('isSearchShortcut', () => {
  it('accepts Ctrl+P off Apple platforms and Cmd+P on them', () => {
    expect(isSearchShortcut(press({ key: 'p', ctrlKey: true }), false)).toBe(
      true,
    )
    expect(isSearchShortcut(press({ key: 'P', metaKey: true }), true)).toBe(
      true,
    )
  })

  it('leaves Ctrl+P to the text on Apple platforms and Cmd+P elsewhere', () => {
    expect(isSearchShortcut(press({ key: 'p', ctrlKey: true }), true)).toBe(
      false,
    )
    expect(isSearchShortcut(press({ key: 'p', metaKey: true }), false)).toBe(
      false,
    )
  })

  it('ignores Alt, Shift and other letters', () => {
    expect(
      isSearchShortcut(press({ key: 'p', ctrlKey: true, altKey: true }), false),
    ).toBe(false)
    expect(
      isSearchShortcut(
        press({ key: 'p', ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe(false)
    expect(isSearchShortcut(press({ key: 'b', ctrlKey: true }), false)).toBe(
      false,
    )
  })
})
