import { describe, expect, it } from 'vitest'
import { appendAiCall, enrichAiCall } from './dev-log'
import { shapeAiCallRecord } from './records'

const record = shapeAiCallRecord({
  task: 'task',
  attempt: 1,
  outcome: 'valid',
  startedAt: '2026-10-28T12:00:00.000Z',
  observation: { requestedModel: 'vendor/model-a' },
  timing: { clientTotalMs: 10 },
})

describe('appendAiCall', () => {
  it('creates the log on first use', () => {
    const target: { __aiCalls?: (typeof record)[] } = {}
    appendAiCall(target, record)
    expect(target.__aiCalls).toEqual([record])
  })

  it('appends to the same array so earlier readers see new records', () => {
    const target: { __aiCalls?: (typeof record)[] } = {}
    appendAiCall(target, record)
    const log = target.__aiCalls
    appendAiCall(target, { ...record, task: 'second' })
    expect(target.__aiCalls).toBe(log)
    expect(log?.map((entry) => entry.task)).toEqual(['task', 'second'])
  })
})

describe('enrichAiCall', () => {
  const withId = { ...record, generationId: 'gen-1' }

  it('replaces the record with the same generation id', () => {
    const target: { __aiCalls?: (typeof record)[] } = {}
    appendAiCall(target, withId)
    const log = target.__aiCalls
    const enriched = { ...withId, provider: 'Acme' }
    enrichAiCall(target, enriched)
    expect(target.__aiCalls).toBe(log)
    expect(log).toEqual([enriched])
  })

  it('appends when no record has that generation id', () => {
    const target: { __aiCalls?: (typeof record)[] } = {}
    appendAiCall(target, withId)
    enrichAiCall(target, { ...withId, generationId: 'gen-2' })
    expect(target.__aiCalls?.map((entry) => entry.generationId)).toEqual([
      'gen-1',
      'gen-2',
    ])
  })

  it('never matches records without a generation id', () => {
    const target: { __aiCalls?: (typeof record)[] } = {}
    appendAiCall(target, record)
    enrichAiCall(target, record)
    expect(target.__aiCalls).toHaveLength(2)
  })
})
