import { useCallback, useMemo, useRef, useState } from 'react'
import type { DocumentControls } from '../editor/document-controls'
import {
  beforeReviewChanges,
  type ReviewControls,
} from '../editor/review-controls'
import { idleReviewStatus, type ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import { applyHistoryEvent, type HistoryEvent } from '../history/events'
import type { HistoryRecorder } from '../history/recorder'
import { formatClock } from '../history/time'
import type { Version } from '../history/types'
import { noticeMessage } from '../suggestions/notice'
import type { SuggestionNotice } from '../suggestions/types'
import { EditorPane } from './EditorPane'
import { FileControls } from './FileControls'
import { FileName } from './FileName'
import { FullHistory } from './FullHistory'
import { Hint } from './Hint'
import { LineDiff } from './LineDiff'
import { MissingKeyBanner } from './MissingKeyBanner'
import { ReviewToolbar } from './ReviewToolbar'
import { Timeline } from './Timeline'
import { Toast, type ToastMessage } from './Toast'
import { useHistoryView } from './use-history-view'
import { useMarkdownFile } from './use-markdown-file'
import { VersionBar } from './VersionBar'

type AppProps = {
  readonly initialDoc: string
  readonly hasApiKey: boolean
  readonly onDocumentChange: (doc: string) => void
  readonly history: HistoryRecorder
}

export function App({
  initialDoc,
  hasApiKey,
  onDocumentChange,
  history,
}: AppProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [review, setReview] = useState<ReviewStatus>(idleReviewStatus)
  const [controls, setControls] = useState<ReviewControls | null>(null)
  const [documentControls, setDocumentControls] =
    useState<DocumentControls | null>(null)
  const toastId = useRef(0)
  const headerRef = useRef<HTMLElement>(null)
  const getTopInset = useCallback(
    () => headerRef.current?.getBoundingClientRect().bottom ?? 0,
    [],
  )
  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback(
    (text: string, retry?: () => void) =>
      setToast({
        id: ++toastId.current,
        text,
        ...(retry && { action: { label: 'Retry', run: retry } }),
      }),
    [],
  )
  const onNotice = useCallback(
    (notice: SuggestionNotice) => showToast(noticeMessage(notice.kind)),
    [showToast],
  )
  const onReviewNotice = useCallback(
    (notice: ReviewNotice) => showToast(notice.text, notice.retry),
    [showToast],
  )
  const onHistoryEvent = useCallback(
    (event: HistoryEvent) => applyHistoryEvent(history, event),
    [history],
  )
  const focusEditor = useCallback(
    () => documentControls?.focus(),
    [documentControls],
  )
  const historyView = useHistoryView(history, focusEditor)
  const { mode, versions, close: closeHistory } = historyView
  const onOpened = useCallback(
    (opened: { readonly text: string; readonly name: string }) => {
      history.opened(opened)
      closeHistory()
    },
    [history, closeHistory],
  )
  const file = useMarkdownFile({
    controls: documentControls,
    notify: showToast,
    onOpened,
    onSaving: history.saving,
    onSaved: history.saved,
  })
  const { edited } = file
  const onChange = useCallback(
    (doc: string) => {
      onDocumentChange(doc)
      edited(doc)
    },
    [onDocumentChange, edited],
  )

  const shown =
    mode.kind === 'version'
      ? versions.find((version) => version.id === mode.id)
      : undefined
  const currentText = documentControls?.text() ?? ''
  const reviewControls = useMemo(
    () => controls && beforeReviewChanges(controls, closeHistory),
    [controls, closeHistory],
  )

  const restore = useCallback(
    (version: Version): void => {
      if (documentControls === null) return
      documentControls.restore(version.text)
      history.restored({ text: version.text, from: version.id })
      closeHistory()
      showToast(
        `Restored the Version from ${formatClock(version.at, Date.now())}`,
      )
    },
    [documentControls, history, closeHistory, showToast],
  )

  return (
    <div className="min-h-screen">
      <header ref={headerRef} className="sticky top-0 z-30 bg-canvas">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 pt-6 pb-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-display font-semibold text-2xl text-ink-strong tracking-wide">
              Chiri
            </h1>
            {file.session ? (
              <FileName name={file.session.name} dirty={file.session.dirty} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <Hint />
            <FileControls
              disabled={documentControls === null}
              inputRef={file.inputRef}
              onOpen={file.open}
              onSave={file.save}
            />
            <ReviewToolbar status={review} controls={reviewControls} />
          </div>
        </div>
        <Timeline
          versions={versions}
          mode={mode}
          highlighted={historyView.hovered}
          onDot={historyView.onDot}
          onNow={historyView.close}
          onToggleFull={historyView.toggleFull}
        />
        {shown ? (
          <VersionBar
            versions={versions}
            version={shown}
            currentText={currentText}
            onStep={historyView.step}
            onRestore={restore}
            onClose={historyView.close}
          />
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-4 pb-40">
        {shown ? <LineDiff before={currentText} after={shown.text} /> : null}
        {mode.kind === 'full' ? (
          <FullHistory
            versions={versions}
            flashId={historyView.flashId}
            onHover={historyView.setHovered}
            onView={historyView.view}
          />
        ) : null}
        <div hidden={mode.kind !== 'editing'}>
          <EditorPane
            initialDoc={initialDoc}
            onChange={onChange}
            onNotice={onNotice}
            onReviewStatus={setReview}
            onReviewNotice={onReviewNotice}
            onReviewControls={setControls}
            onDocumentControls={setDocumentControls}
            onHistoryEvent={onHistoryEvent}
            getTopInset={getTopInset}
          />
        </div>
      </main>
      <Toast message={toast} onDismiss={dismissToast} />
      {hasApiKey ? null : <MissingKeyBanner />}
    </div>
  )
}
