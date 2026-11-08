import { useCallback, useEffect, useRef, useState } from 'react'
import type { EvalSummary } from '../evals/report'
import type { EvalSettings } from '../evals/settings'
import type { EvalPrepareResult, EvalsKit, StoppedRun } from '../evals/types'

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

export type EvalDialogState =
  | { readonly status: 'closed' }
  | { readonly status: 'preparing' }
  | {
      readonly status: 'confirm'
      readonly prepared: Extract<EvalPrepareResult, { kind: 'ready' }>
    }

const POLL_MS = 1500

const REASONS = {
  'no-cli': 'The Claude CLI was not found',
  'risks-changed': 'The Skill changed while you were confirming. Run again.',
  busy: 'Another Eval run is in progress',
} as const

export const useEvalPanel = (evals: EvalsKit, skillPath: string) => {
  const [state, setState] = useState<EvalPanelState>({ status: 'loading' })
  const [dialog, setDialog] = useState<EvalDialogState>({ status: 'closed' })
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
    const prepared = await evals.prepare({ skillPath })
    if (prepared.kind === 'ready') {
      setDialog({ status: 'confirm', prepared })
      return
    }
    setDialog({ status: 'closed' })
    if (prepared.kind === 'no-cli') setState({ status: 'no-cli' })
    else setMessage(prepared.reason)
  }, [evals, skillPath])

  const close = useCallback(() => setDialog({ status: 'closed' }), [])

  const run = useCallback(
    async (settings: EvalSettings) => {
      setDialog({ status: 'closed' })
      latest.current += 1
      patchReady({ running: true, cancelling: false, stopped: null })
      setMessage(null)
      const result = await evals.run({ skillPath, ...settings })
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
    [evals, skillPath, patchReady],
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

  const openReport = useCallback(async () => {
    const result = await evals.openReport({ skillPath })
    if (result.kind === 'failed') setMessage(result.reason)
  }, [evals, skillPath])

  return {
    state,
    dialog,
    running,
    cancelling,
    message,
    refresh,
    ask,
    close,
    run,
    cancel,
    openReport,
  }
}
