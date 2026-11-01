import type { FileSession } from './file-session'

export type LeaveChoice = 'save' | 'discard' | 'cancel'

export type LeaveOptions<Ref> = {
  readonly ask: (name: string) => Promise<LeaveChoice>
  readonly discard: (ref: Ref) => void
}

type ConfirmLeave<Ref> = {
  readonly session: FileSession<Ref> | null
  readonly leave: LeaveOptions<Ref>
  readonly save: () => Promise<boolean>
}

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

export const confirmLeave = async <Ref>({
  session,
  leave,
  save,
}: ConfirmLeave<Ref>): Promise<boolean> => {
  if (session === null || !session.dirty) return true
  const choice = await answerFor(leave, session.name)
  if (choice === 'cancel') return false
  if (choice === 'save') return save()
  if (session.ref !== null) leave.discard(session.ref)
  return true
}
