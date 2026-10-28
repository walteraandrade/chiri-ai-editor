import { detectApplePlatform, formatShortcut } from './platform'

const shortcut = formatShortcut('K', detectApplePlatform())

export function Hint() {
  return (
    <p className="text-sm text-ink-muted">
      Select text and press{' '}
      <kbd className="rounded bg-code-bg px-1.5 py-0.5 font-sans text-ink">
        {shortcut}
      </kbd>
    </p>
  )
}
