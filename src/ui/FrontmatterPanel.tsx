import { type RefObject, useId } from 'react'
import {
  type FrontmatterReport,
  type PanelProblem,
  problemsOfField,
} from '../skills/frontmatter-panel'
import type { SkillField } from '../skills/skill-frontmatter'

type FrontmatterPanelProps = {
  readonly report: FrontmatterReport
  readonly disabled: boolean
  readonly panelRef: RefObject<HTMLElement | null>
  readonly onEdit: (field: SkillField, value: string) => void
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
}

const INPUT_CLASS =
  'cm-ai-bubble-input w-full aria-invalid:outline aria-invalid:outline-1 aria-invalid:outline-danger'

function ProblemList({ id, problems }: ProblemListProps) {
  return problems.length === 0 ? null : (
    <ul id={id} className="mt-1 space-y-0.5 text-danger text-xs">
      {problems.map((problem) => (
        <li key={problem.message}>{problem.message}</li>
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
    className: INPUT_CLASS,
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
          onChange={(event) => onEdit(field, event.target.value)}
        />
      )}
      <ProblemList id={problemsId} problems={problems} />
    </div>
  )
}

export function FrontmatterPanel({
  report,
  disabled,
  panelRef,
  onEdit,
}: FrontmatterPanelProps) {
  if (report.kind === 'none') return null
  if (report.kind === 'unreadable')
    return (
      <section
        ref={panelRef}
        tabIndex={-1}
        aria-label="Frontmatter"
        className="mb-4 scroll-mt-40 bg-danger-tint px-4 py-3 text-sm outline-none"
      >
        <h2 className="font-medium text-ink-strong text-xs">Frontmatter</h2>
        <ul role="alert" className="mt-1 space-y-0.5 text-danger">
          {report.problems.map((problem) => (
            <li key={problem.message}>{problem.message}</li>
          ))}
        </ul>
        {report.skill ? (
          <p className="mt-1 text-ink-muted text-xs">
            The fields come back when the frontmatter is fixed in the editor.
          </p>
        ) : null}
      </section>
    )
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="Frontmatter"
      className="mb-4 scroll-mt-40 bg-surface px-4 py-3 outline-none"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-ink-strong text-xs">Frontmatter</h2>
        <p className="text-ink-faint text-xs">
          {report.present
            ? 'Edits change only these two lines of the YAML'
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
        />
        <SkillFieldInput
          field="description"
          label="description"
          value={report.description}
          problems={problemsOfField(report, 'description')}
          disabled={disabled}
          multiline
          onEdit={onEdit}
        />
      </div>
    </section>
  )
}
