import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import type { ReviewControls } from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'

type ReviewToolbarProps = {
  readonly status: ReviewStatus
  readonly controls: ReviewControls | null
  readonly triggerRef: RefObject<HTMLButtonElement | null>
}

const FOCUS_PLACEHOLDER = 'Focus (optional): tone, concision…'

const countLabel = (added: number): string =>
  `${added} ${added === 1 ? 'suggestion' : 'suggestions'}`

export function ReviewToolbar({
  status,
  controls,
  triggerRef,
}: ReviewToolbarProps) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = (): void => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const submit = (): void => {
    controls?.start(focus.trim())
    setFocus('')
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="relative flex flex-wrap items-center justify-end gap-2 text-sm"
    >
      {status.open > 0 ? (
        <>
          <button
            type="button"
            className="cm-ai-button cm-ai-button-primary rise-in"
            onClick={() => controls?.acceptAll()}
          >
            Accept all
          </button>
          <button
            type="button"
            className="cm-ai-button rise-in"
            onClick={() => controls?.rejectAll()}
          >
            Reject all
          </button>
        </>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className="cm-ai-button"
        aria-busy={status.running || undefined}
        aria-haspopup={status.running ? undefined : 'dialog'}
        aria-expanded={status.running ? undefined : open}
        aria-controls={!status.running && open ? popoverId : undefined}
        title={status.running ? 'Stop the Review pass' : undefined}
        disabled={controls === null}
        onClick={
          status.running
            ? () => controls?.stop()
            : () => setOpen((value) => !value)
        }
      >
        {status.running ? (
          <>
            <span className="cm-ai-pulse" aria-hidden="true" />
            Reviewing…
            {status.added > 0 ? (
              <span key={status.added} className="cm-ai-count ml-1">
                {countLabel(status.added)}
              </span>
            ) : null}
            <span className="ml-2 text-ink-strong">Stop</span>
          </>
        ) : (
          'Review'
        )}
      </button>
      {open && !status.running ? (
        <form
          id={popoverId}
          role="dialog"
          aria-label="Review the Document"
          className="popover-in absolute top-full right-0 z-30 mt-2 flex w-[min(24rem,calc(100vw-3rem))] gap-2 border border-hairline bg-raised p-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            close()
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="cm-ai-bubble-input"
            placeholder={FOCUS_PLACEHOLDER}
            aria-label="Focus (optional)"
            autoComplete="off"
            spellCheck={false}
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
          />
          <button type="submit" className="cm-ai-button">
            Review
          </button>
        </form>
      ) : null}
    </div>
  )
}
