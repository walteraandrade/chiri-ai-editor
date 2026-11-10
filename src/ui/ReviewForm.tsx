import { useEffect, useRef, useState } from 'react'

type ReviewFormProps = {
  readonly id?: string
  readonly className: string
  readonly onSubmit: (focus: string) => void
  readonly onClose: () => void
  readonly dismissOnOutside?: boolean
}

const FOCUS_PLACEHOLDER = 'Focus (optional): tone, concision…'

export function ReviewForm({
  id,
  className,
  onSubmit,
  onClose,
  dismissOnOutside = false,
}: ReviewFormProps) {
  const [focus, setFocus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!dismissOnOutside) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (!formRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [dismissOnOutside, onClose])

  return (
    <form
      ref={formRef}
      id={id}
      role="dialog"
      aria-label="Review the Document"
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(focus.trim())
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
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
  )
}
