import type { KeyboardEvent } from 'react'
import { describeVersion, markOf } from '../history/story'
import { formatClock } from '../history/time'
import type { History, VersionId } from '../history/types'
import { dotTarget, type HistoryMode } from '../history/view-mode'
import { VersionMark } from './VersionMark'

type TimelineProps = {
  readonly versions: History
  readonly mode: HistoryMode
  readonly highlighted: VersionId | null
  readonly onDot: (id: VersionId) => void
  readonly onNow: () => void
  readonly onToggleFull: () => void
}

const tooltipSide = (share: number): string =>
  share < 0.25
    ? 'left-0'
    : share > 0.75
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'

function ListIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M5 4h8M5 8h8M5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
    </svg>
  )
}

export function Timeline({
  versions,
  mode,
  highlighted,
  onDot,
  onNow,
  onToggleFull,
}: TimelineProps) {
  const selectedId = mode.kind === 'version' ? mode.id : null
  const focusId = selectedId ?? versions.at(-1)?.id
  const gaps = Math.max(versions.length - 1, 1)
  const now = Date.now()
  const clockOf = (at: number) => formatClock(at, now)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = Number(
      (event.target as HTMLElement).dataset.versionId ?? Number.NaN,
    )
    const target = dotTarget(
      versions,
      Number.isNaN(current) ? null : current,
      event.key,
    )
    if (target === null) return
    event.preventDefault()
    if (target !== current) onDot(target)
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-version-id="${target}"]`)
      ?.focus()
  }

  return (
    <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 pb-3">
      <div
        role="toolbar"
        aria-label="Timeline"
        className="relative h-8 flex-1"
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-fill-hover" />
        {versions.map((version, index) => {
          const description = describeVersion(versions, version, clockOf)
          const clock = clockOf(version.at)
          const share = index / gaps
          const selected = version.id === selectedId
          return (
            <button
              key={version.id}
              type="button"
              data-version-id={version.id}
              tabIndex={version.id === focusId ? 0 : -1}
              aria-pressed={selected}
              aria-label={`${clock}, ${description.label}: ${description.headline}`}
              onClick={() => onDot(version.id)}
              style={{
                left: `${share * 100}%`,
                width: `min(1.5rem, ${100 / gaps}%)`,
              }}
              className={`group absolute top-1/2 grid h-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-colors hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-accent ${selected ? 'bg-accent-tint outline outline-accent' : highlighted === version.id ? 'bg-fill-hover' : ''}`}
            >
              <VersionMark mark={markOf(version.cause)} />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-full z-40 mt-2 hidden w-64 bg-raised p-3 text-left text-xs shadow-lg group-hover:block group-focus-visible:block ${tooltipSide(share)}`}
              >
                <span className="block text-ink-strong">
                  {description.label} · {clock}
                </span>
                <span className="mt-1 block text-ink-muted">
                  {description.headline}
                </span>
                {version.saved ? (
                  <span className="mt-1 block text-ink-faint">
                    Saved to {version.saved}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        title="Back to the current text (Esc)"
        disabled={mode.kind === 'editing'}
        onClick={onNow}
        className="text-ink-faint text-xs uppercase tracking-widest enabled:text-accent-soft enabled:hover:text-accent"
      >
        Now
      </button>
      <button
        type="button"
        aria-pressed={mode.kind === 'full'}
        onClick={onToggleFull}
        className={`flex items-center gap-1.5 text-xs uppercase tracking-widest ${mode.kind === 'full' ? 'text-accent-soft hover:text-accent' : 'text-ink-muted hover:text-ink-strong'}`}
      >
        <ListIcon />
        Full history
      </button>
    </div>
  )
}
