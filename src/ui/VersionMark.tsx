import type { VersionMark as Mark } from '../history/story'

const markClass: Record<Mark, string> = {
  ai: 'size-2.5 rounded-full bg-accent',
  you: 'size-2 rounded-full bg-ink-muted',
  file: 'size-2.5 border border-ink-faint',
  restore: 'size-2.5 rounded-full border border-ink-muted',
}

export function VersionMark({ mark }: { readonly mark: Mark }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${markClass[mark]}`}
    />
  )
}
