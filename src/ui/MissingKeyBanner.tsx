export function MissingKeyBanner() {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-banner-border border-t bg-banner-bg px-6 py-3 text-center text-banner-ink text-sm"
    >
      OpenRouter key missing. Add{' '}
      <code className="font-mono">OPENROUTER_API_KEY</code> to{' '}
      <code className="font-mono">.env</code> (see{' '}
      <code className="font-mono">.env.example</code>) and restart{' '}
      <code className="font-mono">pnpm dev</code>.
    </div>
  )
}
