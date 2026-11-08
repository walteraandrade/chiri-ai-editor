import { detectApplePlatform, formatShortcut } from './platform'

type LibraryRailProps = {
  readonly open: boolean
  readonly onToggle: () => void
}

export function LibraryRail({ open, onToggle }: LibraryRailProps) {
  const apple = detectApplePlatform()
  const shortcut = formatShortcut('B', apple)
  return (
    <div className="library-rail sticky top-0 z-30 flex h-screen w-10 shrink-0 flex-col items-center border-hairline border-r bg-surface pt-6">
      <button
        type="button"
        className="cm-ai-button text-sm [writing-mode:vertical-rl]"
        aria-label="Library"
        aria-expanded={open}
        aria-controls="library-panel"
        aria-keyshortcuts={apple ? 'Meta+B' : 'Control+B'}
        title={`Library (${shortcut})`}
        onClick={onToggle}
      >
        Library
        <span className="mt-2 inline-block text-ink-faint">{shortcut}</span>
      </button>
    </div>
  )
}
