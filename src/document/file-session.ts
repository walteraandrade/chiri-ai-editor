export type FileSession<H> = {
  readonly name: string
  readonly handle: H | null
  readonly savedText: string
  readonly dirty: boolean
}

export type FileSessionEvent<H> =
  | {
      readonly type: 'opened'
      readonly name: string
      readonly handle: H | null
      readonly text: string
    }
  | {
      readonly type: 'saved'
      readonly name: string
      readonly handle: H | null
      readonly text: string
      readonly current: string
    }
  | { readonly type: 'edited'; readonly text: string }

export const nextFileSession = <H>(
  session: FileSession<H> | null,
  event: FileSessionEvent<H>,
): FileSession<H> | null => {
  if (event.type === 'opened')
    return {
      name: event.name,
      handle: event.handle,
      savedText: event.text,
      dirty: false,
    }
  if (event.type === 'saved')
    return {
      name: event.name,
      handle: event.handle,
      savedText: event.text,
      dirty: event.current !== event.text,
    }
  if (session === null) return null
  const dirty = event.text !== session.savedText
  return dirty === session.dirty ? session : { ...session, dirty }
}
