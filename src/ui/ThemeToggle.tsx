import { type ThemeTokens, themeLabel } from '../theme/tokens'

type ThemeToggleProps = {
  readonly theme: ThemeTokens
  readonly active: boolean
  readonly onToggle: () => void
}

export function ThemeToggle({ theme, active, onToggle }: ThemeToggleProps) {
  const label = themeLabel(theme.name)
  return (
    <button
      type="button"
      className="cm-ai-button theme-toggle"
      aria-pressed={active}
      title={
        active ? 'Use the Chiri theme' : `Follow the Omarchy theme (${label})`
      }
      onClick={onToggle}
    >
      <span
        className="theme-swatch"
        style={{ backgroundColor: active ? theme.accent : 'transparent' }}
        aria-hidden="true"
      />
      Omarchy
      <span className="ml-1.5 text-ink-muted">{label}</span>
    </button>
  )
}
