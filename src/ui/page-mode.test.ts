import { describe, expect, it } from 'vitest'
import { recordVersion, startHistory } from '../history/history'
import type { History } from '../history/types'
import { nextPageMode, type PageMode, visiblePage } from './page-mode'

const history: History = recordVersion(startHistory('a', 1), {
  text: 'b',
  cause: { kind: 'edited' },
  at: 2,
})

const next = nextPageMode(history)
const EDITING: PageMode = { kind: 'editing' }
const EVALS: PageMode = { kind: 'evals' }

describe('nextPageMode', () => {
  it('opens the Evals page from the text', () => {
    expect(next(EDITING, { type: 'toggle-evals' })).toEqual(EVALS)
  })

  it('closes the Evals page when its button is pressed again', () => {
    expect(next(EVALS, { type: 'toggle-evals' })).toEqual(EDITING)
  })

  it('opens the Evals page and keeps it open when asked again', () => {
    expect(next(EDITING, { type: 'open-evals' })).toEqual(EVALS)
    expect(next(EVALS, { type: 'open-evals' })).toEqual(EVALS)
    expect(next({ kind: 'full' }, { type: 'open-evals' })).toEqual(EVALS)
  })

  it('opening the Evals page closes a Version and the Full history', () => {
    expect(next({ kind: 'version', id: 1 }, { type: 'toggle-evals' })).toEqual(
      EVALS,
    )
    expect(next({ kind: 'full' }, { type: 'toggle-evals' })).toEqual(EVALS)
  })

  it('opening a Version or the Full history closes the Evals page', () => {
    expect(next(EVALS, { type: 'show', id: 2 })).toEqual({
      kind: 'version',
      id: 2,
    })
    expect(next(EVALS, { type: 'toggle-full' })).toEqual({ kind: 'full' })
  })

  it('goes back to the text on close', () => {
    expect(next(EVALS, { type: 'close' })).toEqual(EDITING)
  })

  it('ignores a step outside the Version view', () => {
    expect(next(EVALS, { type: 'step', delta: 1 })).toBe(EVALS)
  })

  it('keeps the History transitions', () => {
    expect(next(EDITING, { type: 'show', id: 1 })).toEqual({
      kind: 'version',
      id: 1,
    })
    expect(
      next({ kind: 'version', id: 1 }, { type: 'step', delta: 1 }),
    ).toEqual({ kind: 'version', id: 2 })
  })
})

describe('visiblePage', () => {
  it('falls back to the text when the shown Version is gone', () => {
    expect(visiblePage({ kind: 'version', id: 99 }, history, true)).toEqual(
      EDITING,
    )
  })

  it('falls back to the text when the open file has no Evals page', () => {
    expect(visiblePage(EVALS, history, false)).toEqual(EDITING)
  })

  it('keeps the Evals page when it is available', () => {
    expect(visiblePage(EVALS, history, true)).toBe(EVALS)
  })
})
