export type FileSession<Ref> = {
  readonly name: string
  readonly ref: Ref | null
  readonly savedText: string
  readonly dirty: boolean
}

export type FileSessionEvent<Ref> =
  | {
      readonly type: 'opened'
      readonly name: string
      readonly ref: Ref | null
      readonly text: string
      readonly savedText: string
    }
  | {
      readonly type: 'saved'
      readonly name: string
      readonly ref: Ref | null
      readonly text: string
      readonly current: string
    }
  | { readonly type: 'edited'; readonly text: string }
  | { readonly type: 'cleared' }

export const nextFileSession = <Ref>(
  session: FileSession<Ref> | null,
  event: FileSessionEvent<Ref>,
): FileSession<Ref> | null => {
  if (event.type === 'opened')
    return {
      name: event.name,
      ref: event.ref,
      savedText: event.savedText,
      dirty: event.text !== event.savedText,
    }
  if (event.type === 'saved')
    return {
      name: event.name,
      ref: event.ref,
      savedText: event.text,
      dirty: event.current !== event.text,
    }
  if (event.type === 'cleared' || session === null) return null
  const dirty = event.text !== session.savedText
  return dirty === session.dirty ? session : { ...session, dirty }
}
