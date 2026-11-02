import { describe, expect, it } from 'vitest'
import { historyCommandOf } from './history-keys'

const key = (
  value: string,
  modifiers: Partial<{
    metaKey: boolean
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
  }> = {},
) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
})

describe('historyCommandOf', () => {
  it('maps Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y outside macOS', () => {
    expect(historyCommandOf(key('z', { ctrlKey: true }), false)).toBe('undo')
    expect(
      historyCommandOf(key('Z', { ctrlKey: true, shiftKey: true }), false),
    ).toBe('redo')
    expect(historyCommandOf(key('y', { ctrlKey: true }), false)).toBe('redo')
  })

  it('maps Cmd+Z and Cmd+Shift+Z on macOS, with no Cmd+Y', () => {
    expect(historyCommandOf(key('z', { metaKey: true }), true)).toBe('undo')
    expect(
      historyCommandOf(key('z', { metaKey: true, shiftKey: true }), true),
    ).toBe('redo')
    expect(historyCommandOf(key('y', { metaKey: true }), true)).toBeNull()
  })

  it('ignores the other platform modifier, Alt and plain keys', () => {
    expect(historyCommandOf(key('z', { metaKey: true }), false)).toBeNull()
    expect(historyCommandOf(key('z', { ctrlKey: true }), true)).toBeNull()
    expect(
      historyCommandOf(key('z', { ctrlKey: true, altKey: true }), false),
    ).toBeNull()
    expect(historyCommandOf(key('z'), false)).toBeNull()
    expect(historyCommandOf(key('a', { ctrlKey: true }), false)).toBeNull()
  })

  it('leaves Ctrl+Shift+Y alone', () => {
    expect(
      historyCommandOf(key('y', { ctrlKey: true, shiftKey: true }), false),
    ).toBeNull()
  })
})
