import { type DesafinadoApi, FILE_NOT_FOUND_REASON } from '../../electron/api'
import type { DiskRead, ExternalKit } from './kit'

export type ExternalApi = Pick<
  DesafinadoApi,
  'watchFile' | 'readFile' | 'onExternalChanges'
>

export const pathTouched = (ref: string, paths: readonly string[]): boolean =>
  paths.some((path) => ref === path || ref.startsWith(`${path}/`))

const toDiskRead = (
  result: Awaited<ReturnType<DesafinadoApi['readFile']>>,
): DiskRead => {
  if (result.kind === 'opened')
    return { kind: 'text', name: result.name, text: result.text }
  return result.kind === 'failed' && result.reason === FILE_NOT_FOUND_REASON
    ? { kind: 'gone' }
    : { kind: 'unreadable' }
}

export const createElectronExternal = (
  api: ExternalApi,
): ExternalKit<string> => ({
  watch: (ref) => {
    api.watchFile(ref).catch(() => undefined)
  },
  subscribe: (listener) =>
    api.onExternalChanges(({ paths }) =>
      listener({ touches: (ref) => pathTouched(ref, paths) }),
    ),
  readDisk: async (ref) => {
    try {
      return toDiskRead(await api.readFile(ref))
    } catch {
      return { kind: 'unreadable' }
    }
  },
})
