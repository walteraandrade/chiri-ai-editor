import { describe, expect, it } from 'vitest'
import { BROWSER_PLACEHOLDER_KEY, browserClientConfig } from './browser-client'
import { FALLBACK_MODEL } from './default-model'
import { shapeAiCallRecord } from './records'

const record = shapeAiCallRecord({
  task: 'task',
  attempt: 1,
  outcome: 'valid',
  startedAt: '2026-10-28T12:00:00.000Z',
  observation: { requestedModel: 'vendor/model-a' },
  timing: { clientTotalMs: 10 },
})

describe('browserClientConfig', () => {
  const base = {
    origin: 'http://localhost:5173',
    configuredModel: 'vendor/model-a',
    dev: true,
    logTarget: {},
  }

  it('points at the proxy with a placeholder key', () => {
    const config = browserClientConfig(base)
    expect(config.baseURL).toBe('http://localhost:5173/api/openrouter')
    expect(config.apiKey).toBe(BROWSER_PLACEHOLDER_KEY)
    expect(BROWSER_PLACEHOLDER_KEY).not.toMatch(/^sk-/)
  })

  it('uses the configured model, or the fallback', () => {
    expect(browserClientConfig(base).model).toBe('vendor/model-a')
    expect(browserClientConfig({ ...base, configuredModel: '' }).model).toBe(
      FALLBACK_MODEL,
    )
  })

  it('logs records to window.__aiCalls in dev mode', () => {
    const logTarget: { __aiCalls?: (typeof record)[] } = {}
    browserClientConfig({ ...base, logTarget }).onRecord?.(record)
    expect(logTarget.__aiCalls).toEqual([record])
  })

  it('does not log outside dev mode', () => {
    expect(
      browserClientConfig({ ...base, dev: false }).onRecord,
    ).toBeUndefined()
  })
})
