type StartErrorProps = {
  readonly message: string
}

export function StartError({ message }: StartErrorProps) {
  return (
    <div role="alert" className="mx-auto max-w-3xl px-6 pt-10">
      <h1 className="font-display font-semibold text-2xl text-ink-strong tracking-wide">
        Chiri could not start
      </h1>
      <p className="pt-3 text-danger text-sm">{message}</p>
      <p className="pt-3 text-ink-muted text-sm">
        Close the window and start the app again.
      </p>
    </div>
  )
}
