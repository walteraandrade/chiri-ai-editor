export type ProblemKind = 'history' | 'unsaved'

export type Problems = {
  readonly failed: (kind: ProblemKind) => void
  readonly worked: (kind: ProblemKind) => void
  readonly subscribe: (listener: (kind: ProblemKind) => void) => () => void
}

const MESSAGES: Readonly<Record<ProblemKind, string>> = {
  history: 'History could not be saved.',
  unsaved: 'Your unsaved text could not be saved.',
}

export const problemMessage = (kind: ProblemKind): string => MESSAGES[kind]

export const createProblems = (): Problems => {
  const failing = new Set<ProblemKind>()
  const announced = new Set<ProblemKind>()
  const listeners = new Set<(kind: ProblemKind) => void>()

  const announce = (kind: ProblemKind): void => {
    if (!failing.has(kind) || announced.has(kind) || listeners.size === 0)
      return
    announced.add(kind)
    for (const listener of listeners) listener(kind)
  }

  return {
    failed: (kind) => {
      failing.add(kind)
      announce(kind)
    },
    worked: (kind) => {
      failing.delete(kind)
      announced.delete(kind)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      for (const kind of failing) announce(kind)
      return () => listeners.delete(listener)
    },
  }
}
