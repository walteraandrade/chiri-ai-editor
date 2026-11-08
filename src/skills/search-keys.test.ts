import { describe, expect, it } from 'vitest'
import { searchKey } from './search-keys'

const press = (
  key: string,
  state: { count: number; active: number; text: string },
  extra: Partial<Parameters<typeof searchKey>[0]> = {},
) => searchKey({ key, ...extra }, state)

const some = { count: 3, active: 0, text: 'pr' }

describe('searchKey', () => {
  it('moves down and wraps to the first row', () => {
    expect(press('ArrowDown', some)).toEqual({ kind: 'move', to: 1 })
    expect(press('ArrowDown', { ...some, active: 2 })).toEqual({
      kind: 'move',
      to: 0,
    })
  })

  it('moves up and wraps to the last row', () => {
    expect(press('ArrowUp', { ...some, active: 2 })).toEqual({
      kind: 'move',
      to: 1,
    })
    expect(press('ArrowUp', some)).toEqual({ kind: 'move', to: 2 })
  })

  it('leaves the arrows to the field when there are no rows', () => {
    const none = { count: 0, active: 0, text: 'zz' }
    expect(press('ArrowDown', none)).toEqual({ kind: 'none' })
    expect(press('ArrowUp', none)).toEqual({ kind: 'none' })
  })

  it('opens the highlighted row on Enter', () => {
    expect(press('Enter', { ...some, active: 1 })).toEqual({
      kind: 'open',
      index: 1,
    })
  })

  it('does nothing on Enter without rows', () => {
    expect(press('Enter', { count: 0, active: 0, text: 'zz' })).toEqual({
      kind: 'none',
    })
  })

  it('clears the text on the first Esc', () => {
    expect(press('Escape', some)).toEqual({ kind: 'clear' })
  })

  it('leaves for the text on Esc with no text', () => {
    expect(press('Escape', { count: 0, active: 0, text: '' })).toEqual({
      kind: 'leave',
    })
  })

  it('ignores keys with a modifier', () => {
    expect(press('ArrowDown', some, { ctrlKey: true })).toEqual({
      kind: 'none',
    })
    expect(press('Enter', some, { metaKey: true })).toEqual({ kind: 'none' })
  })

  it('ignores other keys', () => {
    expect(press('a', some)).toEqual({ kind: 'none' })
  })
})
