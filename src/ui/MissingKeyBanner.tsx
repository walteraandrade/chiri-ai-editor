type MissingKeyBannerProps = {
  readonly onSetKey?: (() => void) | undefined
}

export function MissingKeyBanner({ onSetKey }: MissingKeyBannerProps) {
  return (
    <div
      role="status"
      className="pointer-events-auto bg-raised px-6 py-3 text-center text-ink text-sm"
    >
      {onSetKey ? (
        <>
          OpenRouter key missing.{' '}
          <button
            type="button"
            className="cm-ai-button text-ink-strong"
            onClick={onSetKey}
          >
            Set the key
          </button>
        </>
      ) : (
        <>
          OpenRouter key missing. Add{' '}
          <code className="font-mono">OPENROUTER_API_KEY</code> to{' '}
          <code className="font-mono">.env</code> (see{' '}
          <code className="font-mono">.env.example</code>) and restart the dev
          server.
        </>
      )}
    </div>
  )
}
