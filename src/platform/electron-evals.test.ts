import { describe, expect, it, vi } from 'vitest'
import { createElectronEvals, type EvalsApi } from './electron-evals'

const request = { skillPath: '/skills/pdf' }

const api = (overrides: Partial<EvalsApi> = {}): EvalsApi => ({
  evalStatus: vi.fn(async () => ({ kind: 'no-cli' as const })),
  evalPrepare: vi.fn(async () => ({ kind: 'no-cli' as const })),
  evalRun: vi.fn(async () => ({ kind: 'busy' as const })),
  evalOpenReport: vi.fn(async () => ({ kind: 'opened' as const })),
  evalCancel: vi.fn(async () => ({ kind: 'cancelling' as const })),
  ...overrides,
})

describe('createElectronEvals', () => {
  it('passes each call to the main process', async () => {
    const evals = createElectronEvals(api())
    expect(await evals.status(request)).toEqual({ kind: 'no-cli' })
    expect(await evals.prepare(request)).toEqual({ kind: 'no-cli' })
    expect(
      await evals.run({ ...request, runs: 1, model: 'haiku', maxCostUsd: 1 }),
    ).toEqual({ kind: 'busy' })
    expect(await evals.openReport(request)).toEqual({ kind: 'opened' })
    expect(await evals.cancel()).toEqual({ kind: 'cancelling' })
  })

  it('turns a rejected call into a failure', async () => {
    const evals = createElectronEvals(
      api({
        evalRun: vi.fn(async () => {
          throw new Error('gone')
        }),
      }),
    )
    expect(
      (await evals.run({ ...request, runs: 1, model: 'haiku', maxCostUsd: 1 }))
        .kind,
    ).toBe('failed')
  })
})
