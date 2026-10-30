import { describe, expect, it } from 'vitest'
import { fileCommandOf } from './file-commands'

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

describe('fileCommandOf', () => {
  it('maps Ctrl+O, Ctrl+S and Ctrl+Shift+S outside macOS', () => {
    expect(fileCommandOf(key('o', { ctrlKey: true }), false)).toBe('open')
    expect(fileCommandOf(key('s', { ctrlKey: true }), false)).toBe('save')
    expect(
      fileCommandOf(key('S', { ctrlKey: true, shiftKey: true }), false),
    ).toBe('save-as')
  })

  it('maps Cmd on macOS', () => {
    expect(fileCommandOf(key('o', { metaKey: true }), true)).toBe('open')
    expect(fileCommandOf(key('s', { metaKey: true }), true)).toBe('save')
    expect(
      fileCommandOf(key('s', { metaKey: true, shiftKey: true }), true),
    ).toBe('save-as')
  })

  it('ignores the other platform modifier', () => {
    expect(fileCommandOf(key('s', { metaKey: true }), false)).toBeNull()
    expect(fileCommandOf(key('s', { ctrlKey: true }), true)).toBeNull()
    expect(
      fileCommandOf(key('s', { ctrlKey: true, metaKey: true }), false),
    ).toBeNull()
  })

  it('ignores Alt, Shift+O, plain keys and other letters', () => {
    expect(
      fileCommandOf(key('s', { ctrlKey: true, altKey: true }), false),
    ).toBeNull()
    expect(
      fileCommandOf(key('O', { ctrlKey: true, shiftKey: true }), false),
    ).toBeNull()
    expect(fileCommandOf(key('s'), false)).toBeNull()
    expect(fileCommandOf(key('k', { ctrlKey: true }), false)).toBeNull()
  })
})
