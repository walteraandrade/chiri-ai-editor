import type { ChiriApi } from '../../electron/api'
import type { LibraryKit } from './kit'

export type LibraryApi = Pick<
  ChiriApi,
  'listLibrary' | 'addLibraryRoot' | 'removeLibraryRoot'
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
  toRef: (path) => path,
})
