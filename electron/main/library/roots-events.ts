import type { RootsStore } from './roots-store'

export type RootsEvents = {
  readonly store: RootsStore
  readonly subscribe: (listener: () => void) => () => void
}

export const announceRootsSaved = (store: RootsStore): RootsEvents => {
  const listeners = new Set<() => void>()
  return {
    store: {
      load: store.load,
      save: async (projectRoots) => {
        await store.save(projectRoots)
        for (const listener of listeners) listener()
      },
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
