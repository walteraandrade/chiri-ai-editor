import { useEffect } from 'react'

const TOAST_DURATION_MS = 4500
const ACTION_TOAST_DURATION_MS = 12000

export type ToastAction = {
  readonly label: string
  readonly run: () => void
}

export type ToastMessage = {
  readonly id: number
  readonly text: string
  readonly actions: readonly ToastAction[]
}

type ToastProps = {
  readonly message: ToastMessage | null
  readonly onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  const id = message?.id
  const hasAction = (message?.actions.length ?? 0) > 0

  useEffect(() => {
    if (id === undefined) return undefined
    const timer = setTimeout(
      onDismiss,
      hasAction ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS,
    )
    return () => clearTimeout(timer)
  }, [id, hasAction, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-6"
    >
      {message ? (
        <p
          key={message.id}
          className="toast-in pointer-events-auto flex items-center gap-3 bg-raised px-4 py-2 text-ink text-sm shadow-lg"
        >
          <span>{message.text}</span>
          {message.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="cm-ai-button text-ink-strong"
              onClick={() => {
                action.run()
                onDismiss()
              }}
            >
              {action.label}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  )
}
