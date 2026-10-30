import { describeVersion } from '../history/story'
import { formatClock } from '../history/time'
import type { History, Version } from '../history/types'

type VersionBarProps = {
  readonly versions: History
  readonly version: Version
  readonly currentText: string
  readonly onStep: (delta: number) => void
  readonly onRestore: (version: Version) => void
  readonly onClose: () => void
}

export function VersionBar({
  versions,
  version,
  currentText,
  onStep,
  onRestore,
  onClose,
}: VersionBarProps) {
  const { label, headline } = describeVersion(versions, version, formatClock)
  const same = version.text === currentText
  return (
    <div className="mx-auto max-w-3xl px-6 pb-3">
      <section
        aria-label="Version"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-accent-tint px-4 py-2.5 text-sm"
      >
        <p className="min-w-0">
          <span className="text-ink-strong">
            {formatClock(version.at)} · {label}
          </span>
          <span className="text-ink-muted"> · {headline}</span>
          <span className="block text-ink-muted text-xs">
            {same
              ? 'Same text as now.'
              : 'Marks show what Restore changes in the current text.'}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cm-ai-button"
            disabled={versions[0]?.id === version.id}
            onClick={() => onStep(-1)}
          >
            ‹ Older
          </button>
          <button
            type="button"
            className="cm-ai-button"
            disabled={versions.at(-1)?.id === version.id}
            onClick={() => onStep(1)}
          >
            Newer ›
          </button>
          <button
            type="button"
            className="cm-ai-button"
            disabled={same}
            onClick={() => onRestore(version)}
          >
            Restore
          </button>
          <button type="button" className="cm-ai-button" onClick={onClose}>
            Back<kbd className="cm-ai-kbd">Esc</kbd>
          </button>
        </div>
      </section>
    </div>
  )
}
