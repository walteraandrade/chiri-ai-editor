import { useEffect } from 'react'
import { noticeMessage } from '../suggestions/notice'
import type { SuggestionNotice } from '../suggestions/types'

const TOAST_DURATION_MS = 4500

type ToastProps = {
  readonly notice: SuggestionNotice | null
  readonly onDismiss: () => void
}

export function Toast({ notice, onDismiss }: ToastProps) {
  const serial = notice?.serial

  useEffect(() => {
    if (serial === undefined) return undefined
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [serial, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-6"
    >
      {notice ? (
        <p
          key={notice.serial}
          className="toast-in rounded-full border border-border bg-surface px-4 py-2 text-ink text-sm shadow-lg"
        >
          {noticeMessage(notice.kind)}
        </p>
      ) : null}
    </div>
  )
}
