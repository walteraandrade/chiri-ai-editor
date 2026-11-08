import { useCallback, useEffect, useRef, useState } from 'react'
import { NO_BASELINE, type RunBaseline } from '../evals/baseline'
import {
  type EvalDialogState,
  settlePick,
  startPick,
} from '../evals/dialog-state'
import { failureReason } from '../evals/ended'
import type { EvalSummary } from '../evals/report'
import type { EvalSettings } from '../evals/settings'
import type {
  EvalRunResult,
  EvalsKit,
  ReportPart,
  StoppedRun,
} from '../evals/types'

export type EvalPanelState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly claudeVersion: string
      readonly last: EvalSummary | null
      readonly cancelling: boolean
      readonly stopped: StoppedRun | null
    }
  | { readonly status: 'no-cli' }
  | { readonly status: 'failed'; readonly reason: string }

const POLL_MS = 1500

export type EvalSkill = {
  readonly path: string
  readonly name: string
}

type EvalPanelOptions = {
  readonly onEnded: (skill: EvalSkill, result: EvalRunResult) => void
}

export const useEvalPanel = (
  evals: EvalsKit | null,
  skill: EvalSkill | null,
  { onEnded }: EvalPanelOptions,
) => {
  const skillPath = skill?.path ?? null
  const skillName = skill?.name ?? ''
  const currentPath = useRef(skillPath)
  const ended = useRef(onEnded)
  useEffect(() => {
    currentPath.current = skillPath
    ended.current = onEnded
  })
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
  const [going, setGoing] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (evals === null || skillPath === null) return
    const load = ++latest.current
    const result = await evals.status({ skillPath })
    if (load !== latest.current) return
    if (result.kind === 'ready') setGoing(result.runningSkill)
    setState(
      result.kind === 'ready'
        ? {
            status: 'ready',
            claudeVersion: result.claudeVersion,
            last: result.last,
            cancelling: result.cancelling,
            stopped: result.stopped,
          }
        : result.kind === 'no-cli'
          ? { status: 'no-cli' }
          : { status: 'failed', reason: result.reason },
    )
  }, [evals, skillPath])

  useEffect(() => {
    setState({ status: 'loading' })
    setMessage(null)
    setDialog({ status: 'closed' })
    void refresh()
  }, [refresh, setDialog])

  const running = going !== null && going === skillPath
  const cancelling = running && state.status === 'ready' && state.cancelling
  const busyWith = going !== null && going !== skillPath ? going : null
  const polling = going !== null

  useEffect(() => {
    if (!polling) return
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [polling, refresh])

  const patchReady = useCallback(
    (patch: Partial<Extract<EvalPanelState, { status: 'ready' }>>) =>
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, ...patch } : previous,
      ),
    [],
  )

  const ask = useCallback(async () => {
    if (evals === null || skillPath === null) return
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
      if (evals === null || skillPath === null) return
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
      if (evals === null || skillPath === null) return
      setDialog({ status: 'closed' })
      latest.current += 1
      setGoing(skillPath)
      patchReady({ cancelling: false, stopped: null })
      setMessage(null)
      const result = await evals.run({ skillPath, baseline, ...settings })
      setGoing(null)
      latest.current += 1
      ended.current({ path: skillPath, name: skillName }, result)
      if (currentPath.current !== skillPath) return
      const finished = { cancelling: false }
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
      setMessage(failureReason(result))
    },
    [evals, skillPath, skillName, patchReady, setDialog],
  )

  const cancel = useCallback(async () => {
    if (evals === null) return
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
      if (evals === null || skillPath === null) return
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
    busyWith,
    going,
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
