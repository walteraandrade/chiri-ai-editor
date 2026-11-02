import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentControls } from '../editor/document-controls'
import {
  beforeReviewChanges,
  type ReviewControls,
} from '../editor/review-controls'
import { idleReviewStatus, type ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import type { FailureNotice } from '../editor/suggestions'
import { applyHistoryEvent, type HistoryEvent } from '../history/events'
import { formatClock } from '../history/time'
import type { VersionSummary } from '../history/types'
import type { PlatformKit } from '../platform/kit'
import { problemMessage } from '../platform/problems'
import { skillFileLabel } from '../skills/library-view'
import { noticeMessage } from '../suggestions/notice'
import type { SuggestionNotice } from '../suggestions/types'
import { EditorPane } from './EditorPane'
import { ExternalChangeNotice } from './ExternalChangeNotice'
import { FileControls } from './FileControls'
import { FileName } from './FileName'
import { FullHistory } from './FullHistory'
import { Hint } from './Hint'
import { LeaveDialog } from './LeaveDialog'
import { Library } from './Library'
import { LineDiff } from './LineDiff'
import { MissingKeyBanner } from './MissingKeyBanner'
import { ReviewToolbar } from './ReviewToolbar'
import { Timeline } from './Timeline'
import { Toast, type ToastAction, type ToastMessage } from './Toast'
import { useHistoryView } from './use-history-view'
import { useLeavePrompt } from './use-leave-prompt'
import { useLibrary } from './use-library'
import { type FileArrival, useMarkdownFile } from './use-markdown-file'
import { useVersionTexts } from './use-version-texts'
import { VersionBar } from './VersionBar'

type AppProps<Ref> = {
  readonly kit: PlatformKit<Ref>
}

export function App<Ref>({ kit }: AppProps<Ref>) {
  const {
    files,
    unsavedText,
    start,
    notice,
    history,
    keyStatus,
    problems,
    library,
    external,
  } = kit
  const initialDoc = unsavedText.initial
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [review, setReview] = useState<ReviewStatus>(idleReviewStatus)
  const [controls, setControls] = useState<ReviewControls | null>(null)
  const [documentControls, setDocumentControls] =
    useState<DocumentControls | null>(null)
  const toastId = useRef(0)
  const headerRef = useRef<HTMLElement>(null)
  const reviewTriggerRef = useRef<HTMLButtonElement>(null)
  const getTopInset = useCallback(
    () => headerRef.current?.getBoundingClientRect().bottom ?? 0,
    [],
  )
  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback(
    (text: string, actions: readonly ToastAction[] = []) =>
      setToast({ id: ++toastId.current, text, actions }),
    [],
  )
  useEffect(() => {
    if (notice !== null) showToast(notice)
  }, [notice, showToast])
  useEffect(
    () => problems.subscribe((kind) => showToast(problemMessage(kind))),
    [problems, showToast],
  )
  const onNotice = useCallback(
    (notice: SuggestionNotice) => showToast(noticeMessage(notice.kind)),
    [showToast],
  )
  const onReviewNotice = useCallback(
    (notice: ReviewNotice) =>
      showToast(
        notice.text,
        notice.retry ? [{ label: 'Retry', run: notice.retry }] : [],
      ),
    [showToast],
  )
  const onFailure = useCallback(
    (notice: FailureNotice) =>
      showToast(notice.text, [
        { label: 'Retry', run: notice.retry },
        { label: 'Show', run: notice.show },
      ]),
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
    ({ ref, text, name }: FileArrival<Ref>) => {
      history.select(ref)
      history.opened({ text, name })
      closeHistory()
    },
    [history, closeHistory],
  )
  const onReloaded = useCallback(
    ({ ref, text }: FileArrival<Ref>) => {
      history.select(ref)
      history.external({ text })
      closeHistory()
    },
    [history, closeHistory],
  )
  const onSaved = useCallback(
    ({ ref, text, name }: FileArrival<Ref>) => {
      history.select(ref)
      history.saved({ text, name })
    },
    [history],
  )
  const leavePrompt = useLeavePrompt()
  const file = useMarkdownFile({
    files,
    unsavedText,
    start,
    external,
    controls: documentControls,
    notify: showToast,
    onOpened,
    onReloaded,
    onSaving: history.saving,
    onSaved,
    askLeave: leavePrompt.ask,
  })
  const onChange = file.edited
  const libraryControls = useLibrary(library, showToast)
  const openRef = file.session?.ref ?? null
  const fileLabel =
    library === undefined ||
    openRef === null ||
    libraryControls.state.status !== 'ready'
      ? undefined
      : skillFileLabel(
          libraryControls.state.roots,
          (path) => library.toRef(path) === openRef,
        )

  const shown =
    mode.kind === 'version'
      ? versions.find((version) => version.id === mode.id)
      : undefined
  const shownTexts = useVersionTexts(history.text, shown ? [shown.id] : null)
  const shownText = shownTexts?.[0]
  const currentText = documentControls?.text() ?? ''
  const reviewControls = useMemo(
    () => controls && beforeReviewChanges(controls, closeHistory),
    [controls, closeHistory],
  )

  const restore = useCallback(
    (version: VersionSummary, text: string): void => {
      if (documentControls === null) return
      documentControls.restore(text)
      history.restored({ text, from: version.id })
      closeHistory()
      showToast(
        `Restored the Version from ${formatClock(version.at, Date.now())}`,
      )
    },
    [documentControls, history, closeHistory, showToast],
  )
  const onReviewEnd = useCallback((revealed: boolean) => {
    if (!revealed && document.activeElement === document.body)
      reviewTriggerRef.current?.focus()
  }, [])

  const page = (
    <div className="min-h-screen">
      <header ref={headerRef} className="sticky top-0 z-30 bg-canvas">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 pt-6 pb-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-display font-semibold text-2xl text-ink-strong tracking-wide">
              Chiri
            </h1>
            {file.session ? (
              <FileName
                name={fileLabel ?? file.session.name}
                dirty={file.session.dirty}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <Hint />
            <FileControls
              disabled={documentControls === null}
              onOpen={file.open}
              onSave={file.save}
            />
            <ReviewToolbar
              status={review}
              controls={reviewControls}
              triggerRef={reviewTriggerRef}
            />
          </div>
        </div>
        {file.conflict ? (
          <ExternalChangeNotice
            name={file.conflict.name}
            onReload={file.reloadFromDisk}
            onKeep={file.keepMine}
          />
        ) : null}
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
            text={shownText}
            currentText={currentText}
            onStep={historyView.step}
            onRestore={restore}
            onClose={historyView.close}
          />
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-4 pb-40">
        {shown && typeof shownText === 'string' ? (
          <LineDiff before={currentText} after={shownText} />
        ) : null}
        {mode.kind === 'full' ? (
          <FullHistory
            versions={versions}
            flashId={historyView.flashId}
            loadText={history.text}
            onHover={historyView.setHovered}
            onView={historyView.view}
          />
        ) : null}
        <div hidden={mode.kind !== 'editing'}>
          <EditorPane
            initialDoc={initialDoc}
            onChange={onChange}
            onNotice={onNotice}
            onFailure={onFailure}
            onReviewStatus={setReview}
            onReviewNotice={onReviewNotice}
            onReviewControls={setControls}
            onReviewEnd={onReviewEnd}
            onDocumentControls={setDocumentControls}
            onHistoryEvent={onHistoryEvent}
            getTopInset={getTopInset}
          />
        </div>
      </main>
      <Toast message={toast} onDismiss={dismissToast} />
      {keyStatus.present ? null : <MissingKeyBanner />}
      {leavePrompt.prompt === null ? null : (
        <LeaveDialog
          name={leavePrompt.prompt.name}
          onAnswer={leavePrompt.answer}
        />
      )}
    </div>
  )

  return library === undefined ? (
    page
  ) : (
    <div className="flex items-start">
      <Library
        library={library}
        controls={libraryControls}
        activeRef={openRef}
        onOpen={(ref) => void file.openRef(ref)}
      />
      <div className="min-w-0 flex-1">{page}</div>
    </div>
  )
}
