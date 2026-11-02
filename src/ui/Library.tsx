import { useState } from 'react'
import type { LibraryKit } from '../platform/kit'
import type { LibraryRoot } from '../skills/library'
import {
  isSkillOpen,
  type SkillChoices,
  skillCount,
  skillHoldingFile,
} from '../skills/library-view'
import type { Skill } from '../skills/scan-skills'
import type { LibraryControls } from './use-library'

type LibraryProps<Ref> = {
  readonly library: LibraryKit<Ref>
  readonly controls: LibraryControls
  readonly activeRef: Ref | null
  readonly onOpen: (ref: Ref) => void
}

type SkillItemProps = {
  readonly skill: Skill
  readonly open: boolean
  readonly isActiveFile: (path: string) => boolean
  readonly onToggle: () => void
  readonly onOpenFile: (path: string) => void
}

function SkillItem({
  skill,
  open,
  isActiveFile,
  onToggle,
  onOpenFile,
}: SkillItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        title={skill.realPath}
        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-fill"
        onClick={onToggle}
      >
        <span className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="w-2 shrink-0 text-ink-faint text-xs"
          >
            {open ? '▾' : '▸'}
          </span>
          <span className="min-w-0 truncate text-ink-strong text-sm">
            {skill.name}
          </span>
        </span>
        {skill.description === undefined ? null : (
          <span className="line-clamp-2 pl-4 text-ink-muted text-xs">
            {skill.description}
          </span>
        )}
        {skill.problem === undefined ? null : (
          <span className="pl-4 text-danger text-xs">
            Frontmatter: {skill.problem.message}
          </span>
        )}
      </button>
      {open ? (
        <ul className="pb-1 pl-7">
          {skill.files.map((file) => (
            <li key={file.path}>
              {file.isMarkdown ? (
                <button
                  type="button"
                  aria-current={isActiveFile(file.path) ? 'true' : undefined}
                  className={`block w-full truncate px-2 py-1 text-left text-xs hover:bg-fill ${
                    isActiveFile(file.path)
                      ? 'bg-accent-tint text-ink-strong'
                      : 'text-ink'
                  }`}
                  title={file.path}
                  onClick={() => onOpenFile(file.path)}
                >
                  {file.name}
                </button>
              ) : (
                <span
                  className="block truncate px-2 py-1 text-ink-faint text-xs"
                  title="Only Markdown files open in Chiri"
                >
                  {file.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

type RootSectionProps = {
  readonly root: LibraryRoot
  readonly choices: SkillChoices
  readonly holdingOpenFile: string | undefined
  readonly isActiveFile: (path: string) => boolean
  readonly onToggle: (realPath: string, open: boolean) => void
  readonly onOpenFile: (path: string) => void
  readonly onRemove: () => void
}

function RootSection({
  root,
  choices,
  holdingOpenFile,
  isActiveFile,
  onToggle,
  onOpenFile,
  onRemove,
}: RootSectionProps) {
  return (
    <section aria-label={root.label} className="pb-3">
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <h3
          className="min-w-0 truncate font-medium text-ink-muted text-xs"
          title={root.root}
        >
          {root.label}
          {root.readable ? (
            <span className="text-ink-faint"> · {root.skills.length}</span>
          ) : null}
        </h3>
        {root.removable ? (
          <button
            type="button"
            className="cm-ai-button px-2 py-0 text-xs"
            aria-label={`Remove ${root.label} from the Library`}
            title="Remove from the Library. The folder stays on disk."
            onClick={onRemove}
          >
            ×
          </button>
        ) : null}
      </div>
      {!root.readable ? (
        <p className="px-3 py-1 text-ink-faint text-xs">
          Folder not found or not readable
        </p>
      ) : root.skills.length === 0 ? (
        <p className="px-3 py-1 text-ink-faint text-xs">No skills here</p>
      ) : (
        <ul>
          {root.skills.map((skill) => {
            const open = isSkillOpen(choices, skill.realPath, holdingOpenFile)
            return (
              <SkillItem
                key={skill.realPath}
                skill={skill}
                open={open}
                isActiveFile={isActiveFile}
                onToggle={() => onToggle(skill.realPath, !open)}
                onOpenFile={onOpenFile}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Library<Ref>({
  library,
  controls: { state, refresh, addRoot, removeRoot },
  activeRef,
  onOpen,
}: LibraryProps<Ref>) {
  const [choices, setChoices] = useState<SkillChoices>({})
  const isActiveFile = (path: string): boolean =>
    activeRef !== null && library.toRef(path) === activeRef
  const roots = state.status === 'ready' ? state.roots : []
  const holdingOpenFile = skillHoldingFile(roots, isActiveFile)

  return (
    <aside
      aria-label="Library"
      className="sticky top-0 flex h-screen w-72 shrink-0 flex-col bg-surface"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-6 pb-3">
        <h2 className="font-display font-semibold text-ink-strong text-lg tracking-wide">
          Library
          {state.status === 'ready' ? (
            <span className="font-sans font-normal text-ink-faint text-xs">
              {' '}
              · {skillCount(state.roots)} skills
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            className="cm-ai-button"
            title="Scan the folders again"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="cm-ai-button"
            title="Add a project folder of skills, such as .claude/skills"
            onClick={() => void addRoot()}
          >
            Add
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {state.status === 'loading' ? (
          <p role="status" className="px-3 py-1 text-ink-faint text-xs">
            Reading the skill folders…
          </p>
        ) : null}
        {state.status === 'failed' ? (
          <p role="alert" className="px-3 py-1 text-danger text-xs">
            Could not read the skill folders.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => void refresh()}
            >
              Try again
            </button>
          </p>
        ) : null}
        {state.status === 'ready' && state.problem !== null ? (
          <p role="alert" className="px-3 py-1 text-danger text-xs">
            {state.problem}. Project folders are not listed, and Add and Remove
            are off until it is fixed or deleted in the app's user data folder.
          </p>
        ) : null}
        {roots.map((root) => (
          <RootSection
            key={root.root}
            root={root}
            choices={choices}
            holdingOpenFile={holdingOpenFile}
            isActiveFile={isActiveFile}
            onToggle={(realPath, open) =>
              setChoices((previous) => ({ ...previous, [realPath]: open }))
            }
            onOpenFile={(path) => onOpen(library.toRef(path))}
            onRemove={() => void removeRoot(root.root, root.label)}
          />
        ))}
      </div>
    </aside>
  )
}
