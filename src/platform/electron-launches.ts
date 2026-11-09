import type { DesafinadoApi } from '../../electron/api'
import type { LaunchKit } from './kit'

export type LaunchApi = Pick<DesafinadoApi, 'takeLaunchFile' | 'onLaunchFile'>

export const createElectronLaunches = (api: LaunchApi): LaunchKit<string> => {
  const take = async (): Promise<string | null> => {
    try {
      return await api.takeLaunchFile()
    } catch {
      return null
    }
  }
  return {
    take,
    subscribe: (listener) => {
      const deliver = (): void => {
        void take().then((path) => {
          if (path !== null) listener(path)
        })
      }
      const stop = api.onLaunchFile(deliver)
      deliver()
      return stop
    },
  }
}
