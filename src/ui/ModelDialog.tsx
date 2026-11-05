import { useEffect, useRef, useState } from 'react'
import {
  MODEL_CHANGED_EVENT,
  parseModelChoice,
  readModelChoice,
  writeModelChoice,
} from '../ai/model-choice'

type ModelDialogProps = {
  readonly defaultModel: string
  readonly onClose: () => void
  readonly onSaved: (message: string) => void
}

export function ModelDialog({
  defaultModel,
  onClose,
  onSaved,
}: ModelDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(
    () => readModelChoice(window.localStorage) ?? '',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (element !== null && !element.open) element.showModal()
  }, [])

  const save = (): void => {
    const choice = parseModelChoice(value)
    if (choice.type === 'invalid') {
      setError(choice.message)
      return
    }
    writeModelChoice(
      window.localStorage,
      choice.type === 'model' ? choice.id : undefined,
    )
    window.dispatchEvent(new Event(MODEL_CHANGED_EVENT))
    onSaved(
      choice.type === 'model'
        ? `Model: ${choice.id}`
        : `Model: ${defaultModel} (default)`,
    )
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="model-title"
      className="m-auto w-[min(28rem,calc(100vw-3rem))] bg-raised p-6 border border-hairline text-ink backdrop:bg-canvas"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <h2
          id="model-title"
          className="font-semibold text-ink-strong text-base"
        >
          Model
        </h2>
        <p className="mt-2 text-ink-muted text-sm">
          An OpenRouter model id. Empty uses the default, {defaultModel}. The
          next request uses the new model.
        </p>
        <input
          type="text"
          className="cm-ai-bubble-input mt-4 w-full"
          aria-label="Model id"
          placeholder={defaultModel}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
        {error === null ? null : (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button type="button" className="cm-ai-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="cm-ai-button">
            Save model
          </button>
        </div>
      </form>
    </dialog>
  )
}
