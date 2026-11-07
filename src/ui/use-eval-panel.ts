import { useCallback, useEffect, useRef, useState } from 'react'
import type { EvalSummary } from '../evals/report'
import type { EvalSettings } from '../evals/settings'
import type { EvalPrepareResult, EvalsKit } from '../evals/types'

export type EvalPanelState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly claudeVersion: string
      readonly last: EvalSummary | null
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

const REASONS = {
  'no-cli': 'The Claude CLI was not found',
  'risks-changed': 'The Skill changed while you were confirming. Run again.',
  busy: 'Another Eval run is in progress',
} as const

export const useEvalPanel = (evals: EvalsKit, skillPath: string) => {
  const [state, setState] = useState<EvalPanelState>({ status: 'loading' })
  const [dialog, setDialog] = useState<EvalDialogState>({ status: 'closed' })
  const [running, setRunning] = useState(false)
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
          }
        : result.kind === 'no-cli'
          ? { status: 'no-cli' }
          : { status: 'failed', reason: result.reason },
    )
  }, [evals, skillPath])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
      setRunning(true)
      setMessage(null)
      const result = await evals.run({ skillPath, ...settings })
      setRunning(false)
      if (result.kind === 'completed') {
        setState((previous) =>
          previous.status === 'ready'
            ? { ...previous, last: result.summary }
            : previous,
        )
        return
      }
      setMessage(
        result.kind === 'not-complete'
          ? result.message
          : result.kind === 'failed'
            ? result.reason
            : REASONS[result.kind],
      )
    },
    [evals, skillPath],
  )

  const openReport = useCallback(async () => {
    const result = await evals.openReport({ skillPath })
    if (result.kind === 'failed') setMessage(result.reason)
  }, [evals, skillPath])

  return {
    state,
    dialog,
    running,
    message,
    refresh,
    ask,
    close,
    run,
    openReport,
  }
}
