import { describe, expect, it } from 'vitest'
import { recordVersion, startHistory } from './history'
import type { History } from './types'
import { dotTarget, nextHistoryMode, visibleMode } from './view-mode'

const history: History = ['b', 'c'].reduce<History>(
  (current, text, index) =>
    recordVersion(current, { text, cause: { kind: 'edited' }, at: index + 2 }),
  startHistory('a', 1),
)

const next = nextHistoryMode(history)

describe('nextHistoryMode', () => {
  it('shows a Version, and hides it on a second click', () => {
    const shown = next({ kind: 'editing' }, { type: 'show', id: 2 })
    expect(shown).toEqual({ kind: 'version', id: 2 })
    expect(next(shown, { type: 'show', id: 2 })).toEqual({ kind: 'editing' })
    expect(next(shown, { type: 'show', id: 3 })).toEqual({
      kind: 'version',
      id: 3,
    })
  })

  it('steps to older and newer Versions, stopping at the ends', () => {
    expect(
      next({ kind: 'version', id: 2 }, { type: 'step', delta: -1 }),
    ).toEqual({ kind: 'version', id: 1 })
    expect(
      next({ kind: 'version', id: 1 }, { type: 'step', delta: -1 }),
    ).toEqual({ kind: 'version', id: 1 })
    expect(
      next({ kind: 'version', id: 3 }, { type: 'step', delta: 1 }),
    ).toEqual({ kind: 'version', id: 3 })
  })

  it('ignores a step outside the Version view', () => {
    const full = { kind: 'full' } as const
    expect(next(full, { type: 'step', delta: 1 })).toBe(full)
  })

  it('toggles the Full history from anywhere', () => {
    expect(next({ kind: 'editing' }, { type: 'toggle-full' })).toEqual({
      kind: 'full',
    })
    expect(next({ kind: 'version', id: 1 }, { type: 'toggle-full' })).toEqual({
      kind: 'full',
    })
    expect(next({ kind: 'full' }, { type: 'toggle-full' })).toEqual({
      kind: 'editing',
    })
  })

  it('closes back to the editor', () => {
    expect(next({ kind: 'full' }, { type: 'close' })).toEqual({
      kind: 'editing',
    })
  })
})

describe('visibleMode', () => {
  it('falls back to the editor when the shown Version is gone', () => {
    expect(visibleMode({ kind: 'version', id: 99 }, history)).toEqual({
      kind: 'editing',
    })
    const shown = { kind: 'version', id: 2 } as const
    expect(visibleMode(shown, history)).toBe(shown)
  })
})

describe('dotTarget', () => {
  it('moves with the arrow keys, Home and End', () => {
    expect(dotTarget(history, 2, 'ArrowLeft')).toBe(1)
    expect(dotTarget(history, 2, 'ArrowRight')).toBe(3)
    expect(dotTarget(history, 3, 'ArrowRight')).toBe(3)
    expect(dotTarget(history, 2, 'Home')).toBe(1)
    expect(dotTarget(history, 1, 'End')).toBe(3)
  })

  it('starts from the newest Version when none is shown', () => {
    expect(dotTarget(history, null, 'ArrowLeft')).toBe(2)
  })

  it('returns null for other keys', () => {
    expect(dotTarget(history, 2, 'Enter')).toBeNull()
  })
})
