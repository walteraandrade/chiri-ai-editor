import { useCallback, useEffect, useRef, useState } from 'react'
import { NO_BASELINE, type RunBaseline } from '../evals/baseline'
import {
  type EvalDialogState,
  settlePick,
  startPick,
} from '../evals/dialog-state'
import type { EvalSummary } from '../evals/report'
import type { EvalSettings } from '../evals/settings'
import type { EvalsKit, ReportPart, StoppedRun } from '../evals/types'

export type EvalPanelState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly claudeVersion: string
      readonly last: EvalSummary | null
      readonly running: boolean
      readonly cancelling: boolean
      readonly stopped: StoppedRun | null
    }
  | { readonly status: 'no-cli' }
  | { readonly status: 'failed'; readonly reason: string }

const POLL_MS = 1500

const REASONS = {
  'no-cli': 'The Claude CLI was not found',
  'risks-changed': 'The Skill changed while you were confirming. Run again.',
  busy: 'Another Eval run is in progress',
} as const

export const useEvalPanel = (evals: EvalsKit, skillPath: string) => {
  const [state, setState] = useState<EvalPanelState>({ status: 'loading' })
  const [dialog, setDialogState] = useState<EvalDialogState>({
    status: 'closed',
  })
  const dialogRef = useRef<EvalDialogState>({ status: 'closed' })
  const setDialog = useCallback((next: EvalDialogState) => {
    dialogRef.current = next
    setDialogState(next)
  }, [])
  const [message, setMessage] = useState<string | null>(null)
  const latest = useRef(0)

  const refresh = useCallback(async () => {
    const load = ++latest.current
    const result = await evals.status({ skillPath })
    if (load !== latest.current) return
    setState(
      result.kind === 'ready'
        ? {
            status: 'ready',
            claudeVersion: result.claudeVersion,
            last: result.last,
            running: result.running,
            cancelling: result.cancelling,
            stopped: result.stopped,
          }
        : result.kind === 'no-cli'
          ? { status: 'no-cli' }
          : { status: 'failed', reason: result.reason },
    )
  }, [evals, skillPath])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const running = state.status === 'ready' && state.running
  const cancelling = state.status === 'ready' && state.cancelling

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [running, refresh])

  const patchReady = useCallback(
    (patch: Partial<Extract<EvalPanelState, { status: 'ready' }>>) =>
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, ...patch } : previous,
      ),
    [],
  )

  const ask = useCallback(async () => {
    setMessage(null)
    setDialog({ status: 'preparing' })
    const prepared = await evals.prepare({ skillPath, baseline: NO_BASELINE })
    if (prepared.kind === 'ready') {
      setDialog({
        status: 'confirm',
        prepared,
        baseline: NO_BASELINE,
        refreshing: false,
      })
      return
    }
    setDialog({ status: 'closed' })
    if (prepared.kind === 'no-cli') setState({ status: 'no-cli' })
    else setMessage(prepared.reason)
  }, [evals, skillPath, setDialog])

  const pick = useCallback(
    async (baseline: RunBaseline) => {
      const started = startPick(dialogRef.current, baseline)
      setDialog(started)
      const prepared = await evals.prepare({ skillPath, baseline })
      const settled = settlePick(dialogRef.current, baseline, prepared)
      setDialog(settled.dialog)
      if (settled.effect.kind === 'no-cli') setState({ status: 'no-cli' })
      else if (settled.effect.kind === 'message')
        setMessage(settled.effect.reason)
    },
    [evals, skillPath, setDialog],
  )

  const close = useCallback(() => setDialog({ status: 'closed' }), [setDialog])

  const run = useCallback(
    async (settings: EvalSettings, baseline: RunBaseline) => {
      setDialog({ status: 'closed' })
      latest.current += 1
      patchReady({ running: true, cancelling: false, stopped: null })
      setMessage(null)
      const result = await evals.run({ skillPath, baseline, ...settings })
      latest.current += 1
      const finished = { running: false, cancelling: false }
      if (result.kind === 'completed') {
        patchReady({ ...finished, last: result.summary, stopped: null })
        return
      }
      if (result.kind === 'not-complete') {
        patchReady({
          ...finished,
          stopped: { message: result.message, costUsd: result.costUsd },
        })
        return
      }
      patchReady(finished)
      setMessage(
        result.kind === 'failed' ? result.reason : REASONS[result.kind],
      )
    },
    [evals, skillPath, patchReady, setDialog],
  )

  const cancel = useCallback(async () => {
    latest.current += 1
    patchReady({ cancelling: true })
    const result = await evals.cancel()
    latest.current += 1
    if (result.kind === 'failed') {
      patchReady({ cancelling: false })
      setMessage(result.reason)
    }
  }, [evals, patchReady])

  const openReport = useCallback(
    async (part: ReportPart) => {
      const result = await evals.openReport({ skillPath, part })
      if (result.kind === 'failed') setMessage(result.reason)
    },
    [evals, skillPath],
  )

  return {
    state,
    dialog,
    running,
    cancelling,
    message,
    refresh,
    ask,
    pick,
    close,
    run,
    cancel,
    openReport,
  }
}
