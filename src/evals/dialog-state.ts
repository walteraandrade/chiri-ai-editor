import type { RunBaseline } from './baseline'
import type { EvalPrepareResult } from './types'

export type PreparedReady = Extract<EvalPrepareResult, { kind: 'ready' }>

export type EvalDialogState =
  | { readonly status: 'closed' }
  | { readonly status: 'preparing' }
  | {
      readonly status: 'confirm'
      readonly prepared: PreparedReady
      readonly baseline: RunBaseline
      readonly refreshing: boolean
    }

export type PickSettled = {
  readonly dialog: EvalDialogState
  readonly effect:
    | { readonly kind: 'none' }
    | { readonly kind: 'no-cli' }
    | { readonly kind: 'message'; readonly reason: string }
}

const NO_EFFECT = { kind: 'none' } as const

export const startPick = (
  dialog: EvalDialogState,
  baseline: RunBaseline,
): EvalDialogState =>
  dialog.status === 'confirm'
    ? { ...dialog, baseline, refreshing: true }
    : dialog

export const settlePick = (
  dialog: EvalDialogState,
  baseline: RunBaseline,
  result: EvalPrepareResult,
): PickSettled => {
  if (dialog.status !== 'confirm' || dialog.baseline !== baseline)
    return { dialog, effect: NO_EFFECT }
  if (result.kind === 'ready')
    return {
      dialog: {
        status: 'confirm',
        prepared: result,
        baseline,
        refreshing: false,
      },
      effect: NO_EFFECT,
    }
  const closed = { status: 'closed' } as const
  return result.kind === 'no-cli'
    ? { dialog: closed, effect: { kind: 'no-cli' } }
    : { dialog: closed, effect: { kind: 'message', reason: result.reason } }
}
