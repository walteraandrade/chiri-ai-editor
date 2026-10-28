import type { Telemetry } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { createTelemetryCollector } from './telemetry'

type StartEvent = Parameters<NonNullable<Telemetry['onStart']>>[0]
type CallEndEvent = Parameters<
  NonNullable<Telemetry['onLanguageModelCallEnd']>
>[0]
type EndEvent = Parameters<NonNullable<Telemetry['onEnd']>>[0]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const startEvent = (callId: string, requestId: string) =>
  ({
    callId,
    modelId: 'vendor/m',
    runtimeContext: { requestId },
  }) as unknown as StartEvent

const callEndEvent = (callId: string) =>
  ({
    callId,
    modelId: 'vendor/m-served',
    finishReason: 'stop',
    responseId: 'gen-1',
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      inputTokenDetails: { cacheReadTokens: 2 },
      outputTokenDetails: { reasoningTokens: 1 },
    },
    providerMetadata: {
      openrouter: { provider: 'Acme', usage: { cost: 0.001 } },
    },
  }) as unknown as CallEndEvent

const endEvent = (callId: string) => ({ callId }) as unknown as EndEvent

describe('createTelemetryCollector', () => {
  it('collects usage, cost, provider and response id for a request', async () => {
    const collector = createTelemetryCollector()
    const observed = collector.expect('r1', 'vendor/m')
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onLanguageModelCallEnd?.(callEndEvent('c1'))
    await collector.integration.onEnd?.(endEvent('c1'))
    expect(await observed).toEqual({
      requestedModel: 'vendor/m',
      servedModel: 'vendor/m-served',
      provider: 'Acme',
      finishReason: 'stop',
      inputTokens: 10,
      outputTokens: 5,
      reasoningTokens: 1,
      cachedTokens: 2,
      costUsd: 0.001,
      responseId: 'gen-1',
    })
  })

  it('keeps concurrent requests apart', async () => {
    const collector = createTelemetryCollector()
    const first = collector.expect('r1', 'vendor/m')
    const second = collector.expect('r2', 'vendor/m')
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onStart?.(startEvent('c2', 'r2'))
    await collector.integration.onLanguageModelCallEnd?.({
      ...callEndEvent('c2'),
      responseId: 'gen-2',
    })
    await collector.integration.onEnd?.(endEvent('c2'))
    await collector.integration.onLanguageModelCallEnd?.(callEndEvent('c1'))
    await collector.integration.onEnd?.(endEvent('c1'))
    expect((await first).responseId).toBe('gen-1')
    expect((await second).responseId).toBe('gen-2')
  })

  it('keeps waiting while the request is still running', async () => {
    const collector = createTelemetryCollector(20)
    let settled = false
    const observed = collector.expect('r1', 'vendor/m').then((value) => {
      settled = true
      return value
    })
    await sleep(60)
    expect(settled).toBe(false)
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onLanguageModelCallEnd?.(callEndEvent('c1'))
    await collector.integration.onEnd?.(endEvent('c1'))
    expect((await observed).responseId).toBe('gen-1')
  })

  it('gives up after the grace period once the request is released', async () => {
    const collector = createTelemetryCollector(20)
    const observed = collector.expect('r1', 'vendor/m')
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onLanguageModelCallEnd?.(callEndEvent('c1'))
    collector.release('r1')
    expect(await observed).toMatchObject({
      requestedModel: 'vendor/m',
      responseId: 'gen-1',
    })
  })

  it('settles the request when the call fails', async () => {
    const collector = createTelemetryCollector()
    const observed = collector.expect('r1', 'vendor/m')
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onError?.({
      callId: 'c1',
      error: new Error('Insufficient credits'),
    })
    expect(await observed).toEqual({ requestedModel: 'vendor/m' })
  })

  it('settles the request when the call is aborted', async () => {
    const collector = createTelemetryCollector()
    const observed = collector.expect('r1', 'vendor/m')
    await collector.integration.onStart?.(startEvent('c1', 'r1'))
    await collector.integration.onAbort?.({ callId: 'c1' } as never)
    expect(await observed).toEqual({ requestedModel: 'vendor/m' })
  })

  it('ignores calls that carry no request id', async () => {
    const collector = createTelemetryCollector(10)
    const observed = collector.expect('r1', 'vendor/m')
    await collector.integration.onStart?.({
      callId: 'c9',
      modelId: 'vendor/m',
    } as unknown as StartEvent)
    await collector.integration.onLanguageModelCallEnd?.(callEndEvent('c9'))
    collector.release('r1')
    expect(await observed).toEqual({ requestedModel: 'vendor/m' })
  })
})

describe('getSharedTelemetryCollector', () => {
  const registered = (): readonly unknown[] => {
    const list: unknown = Reflect.get(
      globalThis,
      'AI_SDK_TELEMETRY_INTEGRATIONS',
    )
    return Array.isArray(list) ? list : []
  }

  it('reuses the collector when the module is evaluated again', async () => {
    const first = (await import('./telemetry')).getSharedTelemetryCollector()
    vi.resetModules()
    const second = (await import('./telemetry')).getSharedTelemetryCollector()
    expect(second).toBe(first)
    expect(
      registered().filter((entry) => entry === first.integration),
    ).toHaveLength(1)
  })
})
