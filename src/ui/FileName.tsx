type FileNameProps = {
  readonly name: string
  readonly dirty: boolean
}

export function FileName({ name, dirty }: FileNameProps) {
  return (
    <p className="min-w-0 truncate text-ink-muted text-sm" title={name}>
      {name}
      {dirty ? (
        <span className="text-accent" title="Unsaved changes">
          <span aria-hidden="true"> •</span>
          <span className="sr-only">, unsaved changes</span>
        </span>
      ) : null}
    </p>
  )
}
