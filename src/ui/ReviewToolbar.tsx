import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import type { ReviewControls } from '../editor/review-controls'
import type { ReviewStatus } from '../editor/review-field'
import { ReviewForm } from './ReviewForm'

type ReviewToolbarProps = {
  readonly status: ReviewStatus
  readonly controls: ReviewControls | null
  readonly triggerRef: RefObject<HTMLButtonElement | null>
  readonly trigger?: boolean
}

const POPOVER_CLASS =
  'popover-in absolute top-full right-0 z-30 mt-2 flex w-[min(24rem,calc(100vw-3rem))] gap-2 border border-hairline bg-raised p-2'

const countLabel = (added: number): string =>
  `${added} ${added === 1 ? 'suggestion' : 'suggestions'}`

export function ReviewToolbar({
  status,
  controls,
  triggerRef,
  trigger = true,
}: ReviewToolbarProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

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

  const submit = (focus: string): void => {
    controls?.start(focus)
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
      {trigger || status.running ? (
        <button
          ref={trigger ? triggerRef : undefined}
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
      ) : null}
      {open && !status.running ? (
        <ReviewForm
          id={popoverId}
          className={POPOVER_CLASS}
          onSubmit={submit}
          onClose={close}
        />
      ) : null}
    </div>
  )
}
