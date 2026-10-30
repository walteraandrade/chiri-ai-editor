import type { RefObject } from 'react'
import { MARKDOWN_ACCEPT } from '../document/markdown-file'
import { detectApplePlatform, formatShortcut } from './platform'

type FileControlsProps = {
  readonly disabled: boolean
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onOpen: () => void
  readonly onSave: (saveAs: boolean) => void
}

export function FileControls({
  disabled,
  inputRef,
  onOpen,
  onSave,
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
      <button
        type="button"
        className="cm-ai-button"
        title={`Save (${formatShortcut('S', apple)}). Shift-click or ${saveAs}: Save as`}
        disabled={disabled}
        onClick={(event) => onSave(event.shiftKey)}
      >
        Save
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={MARKDOWN_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
