import { describe, expect, it } from 'vitest'
import type { RunBaseline } from './baseline'
import {
  type EvalDialogState,
  type PreparedReady,
  settlePick,
  startPick,
} from './dialog-state'

const ready = (caseCount: number): PreparedReady => ({
  kind: 'ready',
  claudeVersion: '2.1.319',
  caseCount,
  risks: [],
  baselineRisks: null,
  versions: [],
  sameAsSaved: [],
})

const none: RunBaseline = { kind: 'none' }
const first: RunBaseline = { kind: 'version', versionId: 1 }
const second: RunBaseline = { kind: 'version', versionId: 2 }

const open = (baseline: RunBaseline): EvalDialogState => ({
  status: 'confirm',
  prepared: ready(1),
  baseline,
  refreshing: false,
})

describe('startPick', () => {
  it('marks the open dialog as refreshing for the new baseline', () => {
    expect(startPick(open(none), first)).toMatchObject({
      baseline: first,
      refreshing: true,
    })
  })

  it('leaves a closed dialog closed', () => {
    expect(startPick({ status: 'closed' }, first)).toEqual({ status: 'closed' })
  })
})

describe('settlePick', () => {
  it('shows the new risks once the pick is ready', () => {
    const picked = startPick(open(none), first)
    const settled = settlePick(picked, first, ready(5))
    expect(settled.dialog).toMatchObject({
      refreshing: false,
      prepared: { caseCount: 5 },
    })
    expect(settled.effect).toEqual({ kind: 'none' })
  })

  it('closes the dialog on a failure for the baseline it shows', () => {
    const picked = startPick(open(none), first)
    expect(
      settlePick(picked, first, { kind: 'failed', reason: 'nope' }),
    ).toEqual({
      dialog: { status: 'closed' },
      effect: { kind: 'message', reason: 'nope' },
    })
    expect(settlePick(picked, first, { kind: 'no-cli' }).effect).toEqual({
      kind: 'no-cli',
    })
  })

  it('ignores a stale failure: a newer pick keeps the dialog open', () => {
    const newer = startPick(startPick(open(none), first), second)
    const settled = settlePick(newer, first, { kind: 'failed', reason: 'old' })
    expect(settled.dialog).toBe(newer)
    expect(settled.effect).toEqual({ kind: 'none' })
  })

  it('ignores a stale ready result too', () => {
    const newer = startPick(startPick(open(none), first), second)
    const settled = settlePick(newer, first, ready(9))
    expect(settled.dialog).toBe(newer)
  })

  it('does not reopen a dialog that was closed meanwhile', () => {
    const closed: EvalDialogState = { status: 'closed' }
    expect(settlePick(closed, first, ready(1)).dialog).toBe(closed)
  })
})
