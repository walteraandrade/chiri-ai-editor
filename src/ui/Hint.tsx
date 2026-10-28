import { detectApplePlatform, formatShortcut } from './platform'

export function Hint() {
  const shortcut = formatShortcut('K', detectApplePlatform())
  return (
    <p className="text-sm text-ink-muted">
      Select text and press{' '}
      <kbd className="bg-code-bg px-1.5 py-0.5 font-sans text-ink">
        {shortcut}
      </kbd>
    </p>
  )
}
