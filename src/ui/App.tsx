import { useCallback, useRef, useState } from 'react'
import type { DocumentControls } from '../editor/document-controls'
import type { ReviewControls } from '../editor/review-controls'
import { idleReviewStatus, type ReviewStatus } from '../editor/review-field'
import type { ReviewNotice } from '../editor/review-runtime'
import { noticeMessage } from '../suggestions/notice'
import type { SuggestionNotice } from '../suggestions/types'
import { EditorPane } from './EditorPane'
import { FileControls } from './FileControls'
import { FileName } from './FileName'
import { Hint } from './Hint'
import { MissingKeyBanner } from './MissingKeyBanner'
import { ReviewToolbar } from './ReviewToolbar'
import { Toast, type ToastMessage } from './Toast'
import { useMarkdownFile } from './use-markdown-file'

type AppProps = {
  readonly initialDoc: string
  readonly hasApiKey: boolean
  readonly onDocumentChange: (doc: string) => void
}

export function App({ initialDoc, hasApiKey, onDocumentChange }: AppProps) {
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
  const file = useMarkdownFile({
    controls: documentControls,
    notify: showToast,
  })
  const { edited } = file
  const onChange = useCallback(
    (doc: string) => {
      onDocumentChange(doc)
      edited(doc)
    },
    [onDocumentChange, edited],
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
            <ReviewToolbar status={review} controls={controls} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pt-4 pb-40">
        <EditorPane
          initialDoc={initialDoc}
          onChange={onChange}
          onNotice={onNotice}
          onReviewStatus={setReview}
          onReviewNotice={onReviewNotice}
          onReviewControls={setControls}
          onDocumentControls={setDocumentControls}
          getTopInset={getTopInset}
        />
      </main>
      <Toast message={toast} onDismiss={dismissToast} />
      {hasApiKey ? null : <MissingKeyBanner />}
    </div>
  )
}
