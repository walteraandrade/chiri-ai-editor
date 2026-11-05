import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import type { CreateSkillRequest, LibraryListing } from '../skills/library'
import {
  firstWritableRoot,
  type NewSkillOutcome,
  newSkillDraft,
  newSkillRequest,
  writableRoots,
} from '../skills/new-skill'

type NewSkillDialogProps = {
  readonly roots: LibraryListing
  readonly onCreate: (request: CreateSkillRequest) => Promise<NewSkillOutcome>
  readonly onClose: () => void
}

export function NewSkillDialog({
  roots,
  onCreate,
  onClose,
}: NewSkillDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const rootId = useId()
  const nameId = useId()
  const problemsId = useId()
  const available = writableRoots(roots)
  const [rootPath, setRootPath] = useState(
    () => firstWritableRoot(roots)?.root ?? '',
  )
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const root = available.find((candidate) => candidate.root === rootPath)
  const draft = newSkillDraft(name, root)
  const problems = failure === null ? draft.problems : [failure]

  useEffect(() => {
    const element = dialog.current
    if (element !== null && !element.open) element.showModal()
    nameInput.current?.focus()
  }, [])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (busy || !draft.ready || root === undefined) return
    setBusy(true)
    setFailure(null)
    const result = await onCreate(newSkillRequest(name, root))
    setBusy(false)
    if (result.kind === 'failed') setFailure(result.reason)
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="new-skill-title"
      className="m-auto w-[min(30rem,calc(100vw-3rem))] bg-raised p-6 border border-hairline text-ink backdrop:bg-canvas"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <h2
          id="new-skill-title"
          className="font-semibold text-base text-ink-strong"
        >
          New skill
        </h2>
        <p className="mt-2 text-ink-muted text-sm">
          Creates a folder and a SKILL.md from a template, then opens it.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor={rootId}
              className="mb-1 block font-medium text-ink-muted text-xs"
            >
              Folder
            </label>
            {available.length === 0 ? (
              <p className="text-danger text-sm">
                No folder in the Library can be read. Add one first.
              </p>
            ) : (
              <select
                id={rootId}
                value={rootPath}
                disabled={busy}
                className="cm-ai-bubble-input w-full"
                onChange={(event) => {
                  setRootPath(event.target.value)
                  setFailure(null)
                }}
              >
                {available.map((candidate) => (
                  <option key={candidate.root} value={candidate.root}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label
              htmlFor={nameId}
              className="mb-1 block font-medium text-ink-muted text-xs"
            >
              Name
            </label>
            <input
              ref={nameInput}
              id={nameId}
              type="text"
              value={name}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              placeholder="pdf-processing"
              aria-invalid={problems.length > 0 || undefined}
              aria-describedby={problems.length > 0 ? problemsId : undefined}
              className="cm-ai-bubble-input w-full aria-invalid:outline aria-invalid:outline-1 aria-invalid:outline-danger"
              onChange={(event) => {
                setName(event.target.value)
                setFailure(null)
              }}
            />
            <p aria-live="polite" aria-atomic="true" className="sr-only">
              {failure ?? draft.announcement}
            </p>
            {problems.length === 0 ? null : (
              <ul
                id={problemsId}
                className="mt-1 space-y-0.5 text-danger text-xs"
              >
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            <p className="mt-1 truncate text-ink-faint text-xs">
              {draft.location ?? 'Lowercase letters, digits and hyphens'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            className="cm-ai-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cm-ai-button bg-accent-tint! text-accent-soft! disabled:bg-fill! disabled:text-ink-faint!"
            disabled={!draft.ready || busy}
            aria-busy={busy || undefined}
          >
            Create
          </button>
        </div>
      </form>
    </dialog>
  )
}
