import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { KeyState } from '../../electron/api'
import type { KeySettings } from '../platform/kit'
import {
  describeKeyState,
  offersPlainText,
  removeNote,
  savedKeyMessage,
  saveErrorMessage,
} from './key-status'

type KeyDialogProps = {
  readonly settings: KeySettings
  readonly state: KeyState
  readonly onState: (state: KeyState) => void
  readonly onSaved: (message: string) => void
  readonly onClose: () => void
}

export function KeyDialog({
  settings,
  state,
  onState,
  onSaved,
  onClose,
}: KeyDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const run = async (
    action: () => Promise<KeyState>,
  ): Promise<KeyState | null> => {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      onState(next)
      return next
    } catch (failure) {
      setError(saveErrorMessage(failure))
      return null
    } finally {
      setBusy(false)
    }
  }

  const store = async (action: () => Promise<KeyState>): Promise<void> => {
    const next = await run(action)
    if (next === null) return
    setValue('')
    const message = savedKeyMessage(next)
    if (message === null) return
    onSaved(message)
    dialogRef.current?.close()
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (value.trim() === '') return
    await store(() => settings.save(value))
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="key-dialog-title"
      className="m-auto w-[min(34rem,calc(100vw-3rem))] bg-surface p-6 border border-hairline text-ink backdrop:bg-canvas"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2
          id="key-dialog-title"
          className="font-display font-semibold text-ink-strong text-xl tracking-wide"
        >
          OpenRouter key
        </h2>
        <p className="text-sm text-ink-muted" role="status">
          {describeKeyState(state)}
        </p>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-ink-strong">
            {state.present ? 'Replace the key' : 'Key'}
          </span>
          <input
            type="password"
            name="openrouter-key"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="border border-hairline bg-fill px-3 py-2 font-mono text-ink-strong outline-none focus-visible:outline-2 focus-visible:outline-accent"
            placeholder="Paste the key"
          />
        </label>
        {offersPlainText(state) ? (
          <div className="flex flex-col gap-2 border border-hairline bg-accent-tint p-3 text-sm">
            <p>
              No system keyring is available. Storing the key as plain text
              keeps it across restarts, but anyone who can read your files can
              read it, like <code className="font-mono">.env</code> today.
            </p>
            <div>
              <button
                type="button"
                className="cm-ai-button"
                disabled={busy}
                onClick={() => store(settings.keepAsPlainText)}
              >
                Store as plain text
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
        {removeNote(state) ? (
          <p id="key-remove-note" className="text-ink-muted text-sm">
            {removeNote(state)}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 text-sm">
          {state.present || state.unreadable ? (
            <button
              type="button"
              className="cm-ai-button mr-auto"
              aria-describedby={
                removeNote(state) ? 'key-remove-note' : undefined
              }
              disabled={busy}
              onClick={() => run(settings.clear)}
            >
              Remove key
            </button>
          ) : null}
          <button
            type="button"
            className="cm-ai-button"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button
            type="submit"
            className="cm-ai-button text-ink-strong"
            disabled={busy || value.trim() === ''}
          >
            Save key
          </button>
        </div>
      </form>
    </dialog>
  )
}
