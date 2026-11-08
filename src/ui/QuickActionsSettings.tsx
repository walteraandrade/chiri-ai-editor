import { useEffect, useId, useRef, useState } from 'react'
import {
  addUserQuickAction,
  checkQuickActionDraft,
  draftIsValid,
  isUserQuickAction,
  MAX_INSTRUCTION_LENGTH,
  MAX_LABEL_LENGTH,
  moveQuickAction,
  type QuickActionDraft,
  type QuickActionDraftErrors,
  type QuickActionSettings,
  type QuickActionSlot,
  removeUserQuickAction,
  toggleQuickAction,
  updateUserQuickAction,
} from '../ai/quick-action-settings'
import type { QuickActionId } from '../ai/quick-actions'
import { useListMotion } from './list-motion'
import type { QuickActionsState } from './use-quick-actions'

type Editing =
  | { readonly kind: 'none' }
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly id: QuickActionId }
  | { readonly kind: 'delete'; readonly id: QuickActionId }

const NOT_EDITING: Editing = { kind: 'none' }

const EMPTY_DRAFT: QuickActionDraft = {
  label: '',
  instruction: '',
  skillOnly: false,
}

const draftOf = (slot: QuickActionSlot): QuickActionDraft => ({
  label: slot.action.label,
  instruction: slot.action.instruction,
  skillOnly: slot.action.skillOnly === true,
})

const newUserId = () => `user-${crypto.randomUUID()}` as const

type DraftFormProps = {
  readonly settings: QuickActionSettings
  readonly initial: QuickActionDraft
  readonly editing?: QuickActionId
  readonly submitLabel: string
  readonly onSubmit: (draft: QuickActionDraft) => void
  readonly onCancel: () => void
}

function DraftForm({
  settings,
  initial,
  editing,
  submitLabel,
  onSubmit,
  onCancel,
}: DraftFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<QuickActionDraftErrors>({})
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => labelRef.current?.focus(), [])

  const set = (patch: Partial<QuickActionDraft>): void => {
    setDraft({ ...draft, ...patch })
    setErrors({})
  }

  return (
    <form
      aria-label={
        editing === undefined ? 'New Quick action' : 'Edit Quick action'
      }
      className="quick-action-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const found = checkQuickActionDraft(settings, draft, editing)
        if (draftIsValid(found)) onSubmit(draft)
        else {
          setErrors(found)
          const field = found.label === undefined ? 'instruction' : 'label'
          event.currentTarget
            .querySelector<HTMLElement>(`[name="${field}"]`)
            ?.focus()
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onCancel()
      }}
    >
      <label className="block text-ink-muted text-xs" htmlFor={`${id}-label`}>
        Name
      </label>
      <input
        ref={labelRef}
        id={`${id}-label`}
        name="label"
        className="cm-ai-bubble-input mt-1 w-full"
        value={draft.label}
        maxLength={MAX_LABEL_LENGTH + 20}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={errors.label !== undefined}
        aria-describedby={errors.label ? `${id}-label-error` : undefined}
        onChange={(event) => set({ label: event.target.value })}
      />
      {errors.label ? (
        <p id={`${id}-label-error`} className="mt-1 text-danger text-xs">
          {errors.label}
        </p>
      ) : null}
      <label
        className="mt-3 block text-ink-muted text-xs"
        htmlFor={`${id}-instruction`}
      >
        Instruction
      </label>
      <textarea
        id={`${id}-instruction`}
        name="instruction"
        className="cm-ai-bubble-input mt-1 block min-h-24 w-full resize-y"
        value={draft.instruction}
        maxLength={MAX_INSTRUCTION_LENGTH + 200}
        placeholder="What the AI should do with the text"
        aria-invalid={errors.instruction !== undefined}
        aria-describedby={
          errors.instruction ? `${id}-instruction-error` : undefined
        }
        onChange={(event) => set({ instruction: event.target.value })}
      />
      {errors.instruction ? (
        <p id={`${id}-instruction-error`} className="mt-1 text-danger text-xs">
          {errors.instruction}
        </p>
      ) : null}
      <label className="theme-option mt-2 -mx-2">
        <input
          type="checkbox"
          className="theme-option-mark"
          checked={draft.skillOnly}
          onChange={(event) => set({ skillOnly: event.target.checked })}
        />
        <span className="text-ink text-sm">Only in skills</span>
      </label>
      <div className="mt-3 flex justify-end gap-2 text-sm">
        <button type="button" className="cm-ai-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="cm-ai-button">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

type RowProps = {
  readonly slot: QuickActionSlot
  readonly first: boolean
  readonly last: boolean
  readonly confirming: boolean
  readonly busy: boolean
  readonly onToggle: (on: boolean) => void
  readonly onMove: (delta: -1 | 1) => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onConfirmDelete: () => void
  readonly onKeep: () => void
}

function QuickActionRow({
  slot,
  first,
  last,
  confirming,
  busy,
  onToggle,
  onMove,
  onEdit,
  onDelete,
  onConfirmDelete,
  onKeep,
}: RowProps) {
  const { action, on } = slot
  const mine = isUserQuickAction(action)
  if (confirming)
    return (
      <li
        className="quick-action-row"
        data-quick-action={action.id}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          onKeep()
        }}
      >
        <span className="min-w-0 flex-1 truncate text-ink text-sm">
          Delete “{action.label}”?
        </span>
        <span className="flex shrink-0 gap-1 text-xs">
          <button type="button" className="cm-ai-button" onClick={onKeep}>
            Keep
          </button>
          <button
            type="button"
            className="cm-ai-button"
            data-focus="confirm"
            onClick={onConfirmDelete}
          >
            Delete
          </button>
        </span>
      </li>
    )
  return (
    <li className="quick-action-row" data-quick-action={action.id}>
      <label className="theme-option min-w-0 flex-1">
        <input
          type="checkbox"
          className="theme-option-mark"
          checked={on}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className="min-w-0 flex-1 truncate text-ink-strong text-sm">
          {action.label}
        </span>
        {action.skillOnly ? <span className="cm-ai-ask-tag">Skill</span> : null}
      </label>
      <span className="flex shrink-0 gap-1 text-xs">
        <button
          type="button"
          className="cm-ai-button"
          data-focus="up"
          aria-label={`Move ${action.label} up`}
          disabled={first}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="cm-ai-button"
          data-focus="down"
          aria-label={`Move ${action.label} down`}
          disabled={last}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        {mine ? (
          <>
            <button
              type="button"
              className="cm-ai-button"
              data-focus="edit"
              aria-label={`Edit ${action.label}`}
              disabled={busy}
              onClick={onEdit}
            >
              Edit
            </button>
            <button
              type="button"
              className="cm-ai-button"
              data-focus="delete"
              aria-label={`Delete ${action.label}`}
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        ) : null}
      </span>
    </li>
  )
}

type FocusRequest = {
  readonly id: QuickActionId | 'new'
  readonly control: string
}

type QuickActionsSettingsProps = {
  readonly quickActions: QuickActionsState
}

export function QuickActionsSettings({
  quickActions,
}: QuickActionsSettingsProps) {
  const { settings, ready, change } = quickActions
  const [editing, setEditing] = useState<Editing>(NOT_EDITING)
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const motion = useListMotion(list, '[data-quick-action]', 'quickAction')

  useEffect(() => {
    if (focus === null) return
    const root = list.current
    const target =
      focus.id === 'new'
        ? root?.querySelector<HTMLElement>('[data-focus="new"]')
        : root?.querySelector<HTMLElement>(
            `[data-quick-action="${focus.id}"] [data-focus="${focus.control}"]`,
          )
    const fallback = root?.querySelector<HTMLElement>(
      `[data-quick-action="${focus.id}"] button:not(:disabled)`,
    )
    const element =
      target && !target.matches(':disabled') ? target : (fallback ?? target)
    element?.focus()
    setFocus(null)
  }, [focus])

  const close = (request: FocusRequest): void => {
    setEditing(NOT_EDITING)
    setFocus(request)
  }

  return (
    <fieldset disabled={!ready}>
      <legend className="pt-6 font-semibold text-ink-strong text-sm">
        Quick actions
      </legend>
      <p className="mt-1 text-ink-muted text-xs">
        The ones you turn on show in the Ask AI bubble, in this order.
      </p>
      <div ref={list}>
        <ul className="mt-2" aria-label="Quick actions">
          {settings.map((slot, index) =>
            editing.kind === 'edit' && editing.id === slot.action.id ? (
              <li key={slot.action.id} data-quick-action={slot.action.id}>
                <DraftForm
                  settings={settings}
                  initial={draftOf(slot)}
                  editing={slot.action.id}
                  submitLabel="Save"
                  onSubmit={(draft) => {
                    change((current) =>
                      updateUserQuickAction(current, slot.action.id, draft),
                    )
                    close({ id: slot.action.id, control: 'edit' })
                  }}
                  onCancel={() =>
                    close({ id: slot.action.id, control: 'edit' })
                  }
                />
              </li>
            ) : (
              <QuickActionRow
                key={slot.action.id}
                slot={slot}
                first={index === 0}
                last={index === settings.length - 1}
                confirming={
                  editing.kind === 'delete' && editing.id === slot.action.id
                }
                busy={editing.kind === 'edit' || editing.kind === 'new'}
                onToggle={(on) =>
                  change((current) =>
                    toggleQuickAction(current, slot.action.id, on),
                  )
                }
                onMove={(delta) => {
                  change((current) =>
                    moveQuickAction(current, slot.action.id, delta),
                  )
                  setFocus({
                    id: slot.action.id,
                    control: delta < 0 ? 'up' : 'down',
                  })
                }}
                onEdit={() => setEditing({ kind: 'edit', id: slot.action.id })}
                onDelete={() => {
                  setEditing({ kind: 'delete', id: slot.action.id })
                  setFocus({ id: slot.action.id, control: 'confirm' })
                }}
                onConfirmDelete={() =>
                  void motion.leave(slot.action.id).then(() => {
                    change((current) =>
                      removeUserQuickAction(current, slot.action.id),
                    )
                    close({ id: 'new', control: 'new' })
                  })
                }
                onKeep={() => close({ id: slot.action.id, control: 'delete' })}
              />
            ),
          )}
        </ul>
        {editing.kind === 'new' ? (
          <DraftForm
            settings={settings}
            initial={EMPTY_DRAFT}
            submitLabel="Add"
            onSubmit={(draft) => {
              const id = newUserId()
              change((current) => addUserQuickAction(current, draft, id))
              close({ id, control: 'edit' })
            }}
            onCancel={() => close({ id: 'new', control: 'new' })}
          />
        ) : (
          <button
            type="button"
            className="cm-ai-button mt-3 text-sm"
            data-focus="new"
            disabled={editing.kind === 'edit'}
            onClick={() => setEditing({ kind: 'new' })}
          >
            New Quick action
          </button>
        )}
      </div>
    </fieldset>
  )
}
