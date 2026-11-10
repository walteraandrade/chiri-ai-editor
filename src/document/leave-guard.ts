import type { FileSession } from './file-session'

export type LeaveChoice = 'save' | 'discard' | 'cancel'

export type LeaveOutcome = 'stay' | 'leave' | 'saved'

export type LeaveOptions<Ref> = {
  readonly ask: (name: string) => Promise<LeaveChoice>
  readonly discard: (ref: Ref) => void
  readonly untitledBaseline: string
}

type ConfirmLeave<Ref> = {
  readonly session: FileSession<Ref> | null
  readonly text: string
  readonly leave: LeaveOptions<Ref>
  readonly save: () => Promise<boolean>
}

export const UNTITLED_NAME = 'Untitled'

export const NEW_DOCUMENT_TEXT = ''

const answerFor = async <Ref>(
  { ask }: LeaveOptions<Ref>,
  name: string,
): Promise<LeaveChoice> => {
  try {
    return await ask(name)
  } catch {
    return 'cancel'
  }
}

const hasUnsavedChanges = <Ref>({
  session,
  text,
  leave,
}: ConfirmLeave<Ref>): boolean =>
  session === null
    ? text.trim() !== '' && text !== leave.untitledBaseline
    : session.dirty

export const confirmLeave = async <Ref>(
  options: ConfirmLeave<Ref>,
): Promise<LeaveOutcome> => {
  const { session, leave, save } = options
  if (!hasUnsavedChanges(options)) return 'leave'
  const choice = await answerFor(leave, session?.name ?? UNTITLED_NAME)
  if (choice === 'cancel') return 'stay'
  if (choice === 'save') return (await save()) ? 'saved' : 'stay'
  if (session?.ref != null) leave.discard(session.ref)
  return 'leave'
}
