import { detectApplePlatform, formatShortcut } from './platform'

type FileControlsProps = {
  readonly disabled: boolean
  readonly onOpen: () => void
  readonly onSave: (saveAs: boolean) => void
}

export function FileControls({ disabled, onOpen, onSave }: FileControlsProps) {
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
