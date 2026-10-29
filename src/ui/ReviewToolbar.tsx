import { useEffect, useId, useRef, useState } from 'react'
import type { ReviewControls } from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'

type ReviewToolbarProps = {
  readonly status: ReviewStatus
  readonly controls: ReviewControls | null
}

const FOCUS_PLACEHOLDER = 'Focus (optional): tone, concision…'

const progressLabel = (added: number): string =>
  added === 0
    ? 'Reviewing…'
    : `Reviewing… ${added} ${added === 1 ? 'suggestion' : 'suggestions'}`

export function ReviewToolbar({ status, controls }: ReviewToolbarProps) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverId = useId()
  const wasRunning = useRef(false)

  useEffect(() => {
    if (wasRunning.current && !status.running) {
      const revealed = controls?.revealFirst() ?? false
      if (!revealed && document.activeElement === document.body)
        triggerRef.current?.focus()
    }
    wasRunning.current = status.running
  }, [status.running, controls])

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
            className="cm-ai-button"
            onClick={() => controls?.acceptAll()}
          >
            Accept all
          </button>
          <button
            type="button"
            className="cm-ai-button"
            onClick={() => controls?.rejectAll()}
          >
            Reject all
          </button>
        </>
      ) : null}
      {status.running ? (
        <button
          type="button"
          className="cm-ai-button"
          aria-busy="true"
          title="Stop the Review pass"
          onClick={() => controls?.stop()}
        >
          {progressLabel(status.added)}
          <span className="ml-2 text-ink-strong">Stop</span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className="cm-ai-button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          disabled={controls === null}
          onClick={() => setOpen((value) => !value)}
        >
          Review
        </button>
      )}
      {open && !status.running ? (
        <form
          id={popoverId}
          role="dialog"
          aria-label="Review the Document"
          className="absolute top-full right-0 z-30 mt-2 flex w-[min(24rem,calc(100vw-3rem))] gap-2 bg-raised p-2 shadow-lg"
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
