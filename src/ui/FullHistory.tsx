import { previousVersion } from '../history/history'
import {
  describeVersion,
  historySummary,
  listChanges,
  mixedLabels,
  plural,
} from '../history/story'
import { formatAgo, formatClock } from '../history/time'
import type { History, Version, VersionId } from '../history/types'
import { LineDiff } from './LineDiff'

type FullHistoryProps = {
  readonly versions: History
  readonly flashId: VersionId | null
  readonly onHover: (id: VersionId | null) => void
  readonly onView: (id: VersionId) => void
}

const showsDiff = (version: Version): boolean =>
  version.cause.kind !== 'started' && version.cause.kind !== 'opened'

export function FullHistory({
  versions,
  flashId,
  onHover,
  onView,
}: FullHistoryProps) {
  const { versions: count, fromAi, byYou } = historySummary(versions)
  const first = versions[0]
  const now = Date.now()
  return (
    <article aria-labelledby="full-history-title" className="pt-4">
      <header>
        <h2
          id="full-history-title"
          className="font-display font-semibold text-3xl text-ink-strong tracking-wide"
        >
          How this Document changed
        </h2>
        <p className="mt-2 text-ink-muted text-sm">
          {plural(count, 'Version')}
          {first ? ` since ${formatClock(first.at, now)}` : ''} · {fromAi} from
          AI · {byYou} by you
        </p>
      </header>
      <ol className="mt-10 flex flex-col gap-8">
        {[...versions].reverse().map((version) => {
          const { author, label, headline } = describeVersion(
            versions,
            version,
            (at) => formatClock(at, now),
          )
          const previous = previousVersion(versions, version.id)
          const changes =
            version.cause.kind === 'accepted' ? version.cause.changes : []
          return (
            <li
              key={version.id}
              data-version-id={version.id}
              onMouseEnter={() => onHover(version.id)}
              onMouseLeave={() => onHover(null)}
              className={`group/entry -mx-4 grid scroll-mt-48 grid-cols-[5rem_minmax(0,1fr)] gap-5 px-4 py-3 transition-colors duration-700 ${flashId === version.id ? 'bg-fill' : ''}`}
            >
              <div className="pt-0.5 text-ink-faint text-xs tabular-nums">
                <time dateTime={new Date(version.at).toISOString()}>
                  {formatClock(version.at, now)}
                </time>
                <br />
                {formatAgo(version.at, now)}
              </div>
              <div
                className={`border-l-2 pl-6 ${author === 'ai' ? 'border-accent' : 'border-fill-hover'}`}
              >
                <p className="text-ink-faint text-xs uppercase tracking-widest">
                  {label}
                  {version.saved ? ` · Saved to ${version.saved}` : ''}
                </p>
                <h3 className="mt-1.5 text-ink-strong text-lg">{headline}</h3>
                {changes.length > 1 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-ink-muted text-sm">
                    {listChanges(changes).map(({ key, label, rationale }) => (
                      <li key={key}>
                        {mixedLabels(changes) ? (
                          <span className="text-ink-faint">{label}: </span>
                        ) : null}
                        {rationale}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {previous && showsDiff(version) ? (
                  <div className="mt-4 text-[0.95rem]">
                    <LineDiff
                      before={previous.text}
                      after={version.text}
                      onlyChanged
                    />
                  </div>
                ) : null}
                <div className="mt-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover/entry:opacity-100">
                  <button
                    type="button"
                    className="cm-ai-button text-sm"
                    onClick={() => onView(version.id)}
                  >
                    View in timeline
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
