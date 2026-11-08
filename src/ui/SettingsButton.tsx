import { detectApplePlatform, formatShortcut } from './platform'

type SettingsButtonProps = {
  readonly onClick: () => void
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  const apple = detectApplePlatform()
  return (
    <button
      type="button"
      className="cm-ai-button cm-ai-button-icon"
      aria-label="Preferences"
      aria-keyshortcuts={apple ? 'Meta+,' : 'Control+,'}
      title={`Preferences (${formatShortcut(',', apple)})`}
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      >
        <path d="M2 4h3.5M8.5 4H14M2 8h7.5M12.5 8H14M2 12h1.5M6.5 12H14" />
        <path d="M5.5 2.5v3h3v-3zM9.5 6.5v3h3v-3zM3.5 10.5v3h3v-3z" />
      </svg>
    </button>
  )
}
