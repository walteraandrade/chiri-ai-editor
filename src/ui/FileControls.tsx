import { detectApplePlatform, formatShortcut } from './platform'

type FileControlsProps = {
  readonly disabled: boolean
  readonly problems: readonly string[]
  readonly onOpen: () => void
  readonly onSave: (saveAs: boolean) => void
  readonly onShowProblems: () => void
}

const problemCount = (count: number): string =>
  count === 1 ? '1 problem' : `${count} problems`

export function FileControls({
  disabled,
  problems,
  onOpen,
  onSave,
  onShowProblems,
}: FileControlsProps) {
  const apple = detectApplePlatform()
  const saveAs = apple ? '⇧⌘S' : 'Ctrl+Shift+S'
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        type="button"
        className="cm-ai-button"
        title={`Open a Markdown file (${formatShortcut('O', apple)})`}
        disabled={disabled}
        onClick={onOpen}
      >
        Open
      </button>
      <span className="relative inline-flex">
        <button
          type="button"
          className="cm-ai-button"
          title={`Save (${formatShortcut('S', apple)}). Shift-click or ${saveAs}: Save as`}
          disabled={disabled}
          onClick={(event) => onSave(event.shiftKey)}
        >
          Save
        </button>
        {problems.length === 0 ? null : (
          <button
            type="button"
            className="-top-2 -right-2 absolute min-w-5 bg-danger px-1 text-center font-semibold text-canvas text-xs leading-5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-accent"
            title={`Frontmatter has ${problemCount(problems.length)}. Save still writes the file.\n${problems.join('\n')}`}
            aria-label={`Frontmatter has ${problemCount(problems.length)}: ${problems.join('. ')}`}
            onClick={onShowProblems}
          >
            {problems.length}
          </button>
        )}
      </span>
    </div>
  )
}
