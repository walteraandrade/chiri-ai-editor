import type { ChiriApi } from '../../electron/api'
import type { LibraryKit } from './kit'

export type LibraryApi = Pick<
  ChiriApi,
  | 'listLibrary'
  | 'addLibraryRoot'
  | 'removeLibraryRoot'
  | 'createSkill'
  | 'onExternalChanges'
>

const UNREACHABLE = {
  kind: 'failed',
  reason: 'Could not reach the app',
} as const

const orFailure = async <T>(
  call: () => Promise<T>,
): Promise<T | typeof UNREACHABLE> => {
  try {
    return await call()
  } catch {
    return UNREACHABLE
  }
}

const folderNameOf = (path: string): string | undefined => {
  const folder = path.split('/').slice(0, -1).at(-1)
  return folder === undefined || folder === '' ? undefined : folder
}

export const createElectronLibrary = (api: LibraryApi): LibraryKit<string> => ({
  list: async () => {
    try {
      return { kind: 'listed', ...(await api.listLibrary()) }
    } catch {
      return { kind: 'failed' }
    }
  },
  addRoot: () => orFailure(api.addLibraryRoot),
  removeRoot: (path) => orFailure(() => api.removeLibraryRoot(path)),
  createSkill: (request) => orFailure(() => api.createSkill(request)),
  toRef: (path) => path,
  folderNameOf,
  subscribe: (listener) =>
    api.onExternalChanges(({ library }) => {
      if (library) listener()
    }),
})
