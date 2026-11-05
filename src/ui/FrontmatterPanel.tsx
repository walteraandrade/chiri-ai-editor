import { type KeyboardEvent, type RefObject, useId } from 'react'
import { descriptionSource } from '../skills/description-ai'
import {
  announceProblems,
  type FrontmatterReport,
  otherProblems,
  type PanelProblem,
  problemsOfField,
} from '../skills/frontmatter-panel'
import type { SkillField } from '../skills/skill-frontmatter'
import { type HistoryCommand, historyCommandOf } from './history-keys'
import { detectApplePlatform } from './platform'
import type { DescriptionAi } from './use-description-ai'

type FrontmatterPanelProps = {
  readonly report: FrontmatterReport
  readonly disabled: boolean
  readonly panelRef: RefObject<HTMLElement | null>
  readonly onEdit: (field: SkillField, value: string) => void
  readonly onHistory: (command: HistoryCommand) => void
  readonly descriptionAi?: DescriptionAi
}

type ProblemListProps = {
  readonly id: string
  readonly problems: readonly PanelProblem[]
}

type SkillFieldInputProps = {
  readonly field: SkillField
  readonly label: string
  readonly value: string
  readonly problems: readonly PanelProblem[]
  readonly disabled: boolean
  readonly multiline: boolean
  readonly onEdit: (field: SkillField, value: string) => void
  readonly onHistory: (command: HistoryCommand) => void
}

const INPUT_CLASS =
  'cm-ai-bubble-input w-full aria-invalid:outline aria-invalid:outline-1 aria-invalid:outline-danger'

function ProblemList({ id, problems }: ProblemListProps) {
  return problems.length === 0 ? null : (
    <ul id={id} className="mt-1 space-y-0.5 text-danger text-xs">
      {problems.map((problem) => (
        <li key={problem.rule}>{problem.message}</li>
      ))}
    </ul>
  )
}

function SkillFieldInput({
  field,
  label,
  value,
  problems,
  disabled,
  multiline,
  onEdit,
  onHistory,
}: SkillFieldInputProps) {
  const inputId = useId()
  const problemsId = `${inputId}-problems`
  const shared = {
    id: inputId,
    value,
    disabled,
    spellCheck: false,
    'aria-invalid': problems.length > 0 || undefined,
    'aria-describedby': problems.length > 0 ? problemsId : undefined,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const command = historyCommandOf(event, detectApplePlatform())
      if (command === null) return
      event.preventDefault()
      onHistory(command)
    },
  }
  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block font-medium text-ink-muted text-xs"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          rows={Math.min(Math.max(value.split('\n').length, 2), 8)}
          className={`${INPUT_CLASS} resize-y`}
          onChange={(event) => onEdit(field, event.target.value)}
        />
      ) : (
        <input
          {...shared}
          type="text"
          className={INPUT_CLASS}
          onChange={(event) => onEdit(field, event.target.value)}
        />
      )}
      <ProblemList id={problemsId} problems={problems} />
    </div>
  )
}

function DescriptionAssist({
  ai,
  disabled,
  name,
  description,
  onAccept,
}: {
  readonly ai: DescriptionAi
  readonly disabled: boolean
  readonly name: string
  readonly description: string
  readonly onAccept: (value: string) => void
}) {
  const state =
    ai.state.kind === 'idle' ||
    ai.state.source === descriptionSource(name, description)
      ? ai.state
      : ({ kind: 'idle' } as const)
  return (
    <div className="text-xs">
      {state.kind === 'ready' ? (
        <div className="border border-hairline bg-accent-tint px-3 py-2">
          <p className="text-ink-strong">{state.description}</p>
          <p className="mt-1 text-ink-muted">{state.rationale}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="cm-ai-button"
              onClick={() => {
                onAccept(state.description)
                ai.dismiss()
              }}
            >
              Accept
            </button>
            <button type="button" className="cm-ai-button" onClick={ai.dismiss}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="cm-ai-button"
          disabled={disabled || state.kind === 'working'}
          onClick={() => ai.ask(name, description)}
        >
          {state.kind === 'working' ? 'Improving…' : 'Improve description'}
        </button>
      )}
      {state.kind === 'failed' ? (
        <p role="alert" className="mt-1 text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

function LiveStatus({ text }: { readonly text: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </p>
  )
}

export function FrontmatterPanel({
  report,
  disabled,
  panelRef,
  onEdit,
  onHistory,
  descriptionAi,
}: FrontmatterPanelProps) {
  const othersId = useId()
  if (report.kind === 'none') return null
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="Frontmatter"
      className={`mb-4 scroll-mt-40 px-4 py-3 outline-none ${
        report.kind === 'unreadable' ? 'bg-danger-tint text-sm' : 'bg-surface'
      }`}
    >
      <LiveStatus text={announceProblems(report)} />
      {report.kind === 'unreadable' ? (
        <>
          <h2 className="font-medium text-ink-strong text-xs">Frontmatter</h2>
          <ul className="mt-1 space-y-0.5 text-danger">
            {report.problems.map((problem) => (
              <li key={problem.rule}>{problem.message}</li>
            ))}
          </ul>
          {report.skill ? (
            <p className="mt-1 text-ink-muted text-xs">
              The fields come back when the frontmatter is fixed in the editor.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-medium text-ink-strong text-xs">Frontmatter</h2>
            <p className="text-ink-faint text-xs">
              {report.present
                ? 'Edits change only name and description in the YAML'
                : 'Typing adds the frontmatter to the top of the file'}
            </p>
          </div>
          <div className="space-y-3">
            <SkillFieldInput
              field="name"
              label="name"
              value={report.name}
              problems={problemsOfField(report, 'name')}
              disabled={disabled}
              multiline={false}
              onEdit={onEdit}
              onHistory={onHistory}
            />
            <SkillFieldInput
              field="description"
              label="description"
              value={report.description}
              problems={problemsOfField(report, 'description')}
              disabled={disabled}
              multiline
              onEdit={onEdit}
              onHistory={onHistory}
            />
            {descriptionAi === undefined ? null : (
              <DescriptionAssist
                ai={descriptionAi}
                disabled={disabled || report.description.trim() === ''}
                onAccept={(value) => onEdit('description', value)}
                name={report.name}
                description={report.description}
              />
            )}
            <ProblemList id={othersId} problems={otherProblems(report)} />
          </div>
        </>
      )}
    </section>
  )
}
