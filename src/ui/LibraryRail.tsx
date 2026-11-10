import { detectApplePlatform, formatShortcut } from './platform'

type LibraryRailProps = {
  readonly open: boolean
  readonly onToggle: () => void
  readonly onSearch: () => void
}

export function LibraryRail({ open, onToggle, onSearch }: LibraryRailProps) {
  const apple = detectApplePlatform()
  const shortcut = formatShortcut('B', apple)
  const searchShortcut = formatShortcut('P', apple)
  return (
    <div className="library-rail sticky top-(--title-bar-height) z-30 flex h-(--app-height) w-10 shrink-0 flex-col items-center border-hairline border-r bg-surface pt-6">
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
      <button
        type="button"
        className="cm-ai-button mt-2 text-sm [writing-mode:vertical-rl]"
        aria-label="Search the Library"
        aria-keyshortcuts={apple ? 'Meta+P' : 'Control+P'}
        title={`Search the Library (${searchShortcut})`}
        onClick={onSearch}
      >
        Search
        <span className="mt-2 inline-block text-ink-faint">
          {searchShortcut}
        </span>
      </button>
    </div>
  )
}
