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
      {problems.length === 0 ? null : (
        <button
          type="button"
          className="cm-ai-button gap-1 text-danger! hover:text-danger!"
          title={`Frontmatter: ${problems.join('. ')}. Save still writes the file.`}
          aria-label={`Frontmatter has ${problemCount(problems.length)}: ${problems.join('. ')}`}
          onClick={onShowProblems}
        >
          <span aria-hidden="true">⚠</span>
          {problemCount(problems.length)}
        </button>
      )}
      <button
        type="button"
        className="cm-ai-button"
        title={`Save (${formatShortcut('S', apple)}). Shift-click or ${saveAs}: Save as`}
        disabled={disabled}
        onClick={(event) => onSave(event.shiftKey)}
      >
        Save
      </button>
    </div>
  )
}
