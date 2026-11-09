import type { DesafinadoApi } from '../../electron/api'
import type { EvalsKit } from '../evals/types'

export type EvalsApi = Pick<
  DesafinadoApi,
  'evalStatus' | 'evalPrepare' | 'evalRun' | 'evalOpenReport' | 'evalCancel'
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

export const createElectronEvals = (api: EvalsApi): EvalsKit => ({
  status: (request) => orFailure(() => api.evalStatus(request)),
  prepare: (request) => orFailure(() => api.evalPrepare(request)),
  run: (request) => orFailure(() => api.evalRun(request)),
  openReport: (request) => orFailure(() => api.evalOpenReport(request)),
  cancel: () => orFailure(() => api.evalCancel()),
})
