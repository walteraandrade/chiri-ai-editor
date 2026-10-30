import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { HistoryRecorder } from '../history/recorder'
import type { VersionId } from '../history/types'
import { nextHistoryMode, visibleMode } from '../history/view-mode'

const FLASH_MS = 1200

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

export const useHistoryView = (
  recorder: HistoryRecorder,
  onBackToEditor: () => void,
) => {
  const versions = useSyncExternalStore(recorder.subscribe, recorder.snapshot)
  const [requested, dispatch] = useReducer(nextHistoryMode(versions), {
    kind: 'editing',
  })
  const mode = visibleMode(requested, versions)
  const [hovered, setHovered] = useState<VersionId | null>(null)
  const [flashId, setFlashId] = useState<VersionId | null>(null)
  const close = useCallback(() => dispatch({ type: 'close' }), [])

  const editing = mode.kind === 'editing'
  const wasEditing = useRef(editing)
  const backToEditor = useRef(onBackToEditor)
  useEffect(() => {
    backToEditor.current = onBackToEditor
  }, [onBackToEditor])
  useEffect(() => {
    if (editing && !wasEditing.current) backToEditor.current()
    if (editing) setHovered(null)
    wasEditing.current = editing
  }, [editing])

  useEffect(() => {
    if (editing) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, close])

  useEffect(() => {
    if (flashId === null) return undefined
    const timer = window.setTimeout(() => setFlashId(null), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [flashId])

  const onDot = useCallback(
    (id: VersionId) => {
      if (mode.kind !== 'full') {
        dispatch({ type: 'show', id })
        return
      }
      document
        .querySelector(`li[data-version-id="${id}"]`)
        ?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
      setFlashId(id)
    },
    [mode.kind],
  )

  const view = useCallback((id: VersionId) => {
    dispatch({ type: 'show', id })
    window.scrollTo({ top: 0 })
  }, [])

  return {
    versions,
    mode,
    hovered,
    flashId,
    setHovered,
    onDot,
    view,
    close,
    step: useCallback((delta: number) => dispatch({ type: 'step', delta }), []),
    toggleFull: useCallback(() => {
      dispatch({ type: 'toggle-full' })
      window.scrollTo({ top: 0 })
    }, []),
  }
}
