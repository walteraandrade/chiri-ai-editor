type ExternalChangeNoticeProps = {
  readonly name: string
  readonly onReload: () => void
  readonly onKeep: () => void
}

export function ExternalChangeNotice({
  name,
  onReload,
  onKeep,
}: ExternalChangeNoticeProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-3">
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-accent-tint px-4 py-2 text-ink text-sm"
      >
        <p className="min-w-0 flex-1">
          <span className="text-ink-strong">{name}</span> changed on disk. Save
          will not overwrite it.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="cm-ai-button" onClick={onReload}>
            Reload from disk
          </button>
          <button type="button" className="cm-ai-button" onClick={onKeep}>
            Keep mine
          </button>
        </div>
      </div>
    </div>
  )
}
