import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { DocumentHistory } from '../history/session'
import type { VersionId } from '../history/types'
import { nextPageMode, visiblePage } from './page-mode'

const FLASH_MS = 1200

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

export const useHistoryView = (
  history: Pick<DocumentHistory, 'snapshot' | 'subscribe'>,
  onBackToEditor: () => void,
  evalsAvailable: boolean,
) => {
  const versions = useSyncExternalStore(history.subscribe, history.snapshot)
  const [requested, dispatch] = useReducer(nextPageMode(versions), {
    kind: 'editing',
  })
  const mode = visiblePage(requested, versions, evalsAvailable)
  useEffect(() => {
    if (!evalsAvailable && requested.kind === 'evals')
      dispatch({ type: 'close' })
  }, [evalsAvailable, requested.kind])
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
      const inDialog =
        event.target instanceof Element && event.target.closest('dialog')
      if (event.key === 'Escape' && !event.defaultPrevented && !inDialog)
        close()
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
    openEvals: useCallback(() => {
      dispatch({ type: 'open-evals' })
      window.scrollTo({ top: 0 })
    }, []),
    toggleEvals: useCallback(() => {
      dispatch({ type: 'toggle-evals' })
      window.scrollTo({ top: 0 })
    }, []),
    toggleFull: useCallback(() => {
      dispatch({ type: 'toggle-full' })
      window.scrollTo({ top: 0 })
    }, []),
  }
}
