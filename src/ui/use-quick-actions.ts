import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_QUICK_ACTION_SETTINGS,
  enabledQuickActions,
  type QuickActionSettings,
} from '../ai/quick-action-settings'
import type { QuickAction } from '../ai/quick-actions'
import type { QuickActionStore } from '../platform/quick-action-store'

export type QuickActionsState = {
  readonly settings: QuickActionSettings
  readonly ready: boolean
  readonly enabled: readonly QuickAction[]
  readonly change: (
    edit: (settings: QuickActionSettings) => QuickActionSettings,
  ) => void
}

export function useQuickActions(
  store: QuickActionStore,
  onSaveFailed: () => void,
): QuickActionsState {
  const [settings, setSettings] = useState(DEFAULT_QUICK_ACTION_SETTINGS)
  const [ready, setReady] = useState(false)
  const latest = useRef(DEFAULT_QUICK_ACTION_SETTINGS)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const failed = useRef(onSaveFailed)
  failed.current = onSaveFailed

  useEffect(() => {
    let live = true
    void store.load().then((loaded) => {
      if (!live) return
      latest.current = loaded
      setSettings(loaded)
      setReady(true)
    })
    return () => {
      live = false
    }
  }, [store])

  const enabled = useMemo(() => enabledQuickActions(settings), [settings])

  const change = (
    edit: (settings: QuickActionSettings) => QuickActionSettings,
  ): void => {
    const next = edit(latest.current)
    if (next === latest.current) return
    latest.current = next
    setSettings(next)
    writes.current = writes.current
      .then(() => store.save(next))
      .catch((error: unknown) => {
        console.error('Quick actions could not be saved', error)
        failed.current()
      })
  }

  return { settings, ready, enabled, change }
}
