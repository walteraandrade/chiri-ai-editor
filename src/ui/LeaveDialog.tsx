import { useEffect, useRef } from 'react'
import type { LeaveChoice } from '../document/leave-guard'

type LeaveDialogProps = {
  readonly name: string
  readonly onAnswer: (choice: LeaveChoice) => void
}

export function LeaveDialog({ name, onAnswer }: LeaveDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element !== null && !element.open) element.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="leave-title"
      aria-describedby="leave-detail"
      className="m-auto w-[min(26rem,calc(100vw-3rem))] bg-raised p-6 text-ink shadow-lg backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault()
        onAnswer('cancel')
      }}
    >
      <h2 id="leave-title" className="font-semibold text-ink-strong text-base">
        Save changes to {name}?
      </h2>
      <p id="leave-detail" className="mt-2 text-ink-muted text-sm">
        Discard removes your unsaved changes. Cancel keeps you here.
      </p>
      <div className="mt-5 flex justify-end gap-2 text-sm">
        <button
          type="button"
          className="cm-ai-button"
          onClick={() => onAnswer('cancel')}
        >
          Cancel
        </button>
        <button
          type="button"
          className="cm-ai-button"
          onClick={() => onAnswer('discard')}
        >
          Discard
        </button>
        <button
          type="button"
          className="cm-ai-button bg-accent-tint! text-accent-soft!"
          onClick={() => onAnswer('save')}
        >
          Save
        </button>
      </div>
    </dialog>
  )
}
