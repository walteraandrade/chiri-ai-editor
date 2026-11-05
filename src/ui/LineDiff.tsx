import { useMemo } from 'react'
import type { DiffHunk } from '../diff/adaptive-diff'
import { type LineChange, lineChanges } from '../history/line-changes'

type LineDiffProps = {
  readonly before: string
  readonly after: string
  readonly onlyChanged?: boolean
}

type Row =
  | { readonly key: string; readonly kind: 'line'; readonly text: string }
  | {
      readonly key: string
      readonly kind: 'changed'
      readonly hunks: readonly DiffHunk[]
    }

const BLANK_LINE = ' '

const lineClass = (line: string): string =>
  /^#\s/.test(line)
    ? 'font-bold text-[1.85em] text-ink-strong'
    : /^##\s/.test(line)
      ? 'font-semibold text-[1.5em] text-ink-strong'
      : /^###\s/.test(line)
        ? 'font-semibold text-[1.25em] text-ink-strong'
        : ''

const hunkKey = (hunk: DiffHunk): string =>
  `${hunk.type}-${hunk.type === 'inserted' ? hunk.at : hunk.from}`

function Hunks({ hunks }: { readonly hunks: readonly DiffHunk[] }) {
  return hunks.map((hunk) =>
    hunk.type === 'equal' ? (
      <span key={hunkKey(hunk)}>{hunk.text}</span>
    ) : hunk.type === 'deleted' ? (
      <del key={hunkKey(hunk)} className="cm-ai-deleted">
        {hunk.text}
      </del>
    ) : (
      <ins key={hunkKey(hunk)} className="cm-ai-inserted">
        {hunk.text}
      </ins>
    ),
  )
}

const lineCount = (change: LineChange): number =>
  change.kind === 'same' ? change.lines.length : 1

const rowsOf = (
  changes: readonly LineChange[],
  onlyChanged: boolean,
): readonly Row[] =>
  changes.flatMap((change, index): readonly Row[] => {
    const start = changes
      .slice(0, index)
      .reduce((total, earlier) => total + lineCount(earlier), 0)
    if (change.kind === 'changed')
      return [{ key: `changed-${start}`, kind: 'changed', hunks: change.hunks }]
    return onlyChanged
      ? []
      : change.lines.map((text, offset) => ({
          key: `line-${start + offset}`,
          kind: 'line',
          text,
        }))
  })

export function LineDiff({
  before,
  after,
  onlyChanged = false,
}: LineDiffProps) {
  const rows = useMemo(
    () => rowsOf(lineChanges(before, after), onlyChanged),
    [before, after, onlyChanged],
  )
  if (rows.length === 0)
    return <p className="text-ink-faint text-sm">No text changes.</p>
  return (
    <div
      className={`flex flex-col whitespace-pre-wrap break-words text-[1.0625rem] leading-[1.75] ${onlyChanged ? 'gap-3' : ''}`}
    >
      {rows.map((row) =>
        row.kind === 'line' ? (
          <div key={row.key} className={lineClass(row.text)}>
            {row.text === '' ? BLANK_LINE : row.text}
          </div>
        ) : (
          <div
            key={row.key}
            className={`-mx-3 border-accent border-l-2 bg-fill px-3 ${lineClass(row.hunks[0]?.text ?? '')}`}
          >
            <Hunks hunks={row.hunks} />
          </div>
        ),
      )}
    </div>
  )
}
