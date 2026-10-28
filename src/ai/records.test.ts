import { describe, expect, it } from 'vitest'
import {
  type CallObservation,
  formatRecordRow,
  formatRecordsTable,
  type OpenRouterGeneration,
  shapeAiCallRecord,
} from './records'

const observation: CallObservation = {
  requestedModel: 'vendor/model-a',
  servedModel: 'vendor/model-a-20260101',
  provider: 'FromTelemetry',
  finishReason: 'stop',
  inputTokens: 812,
  outputTokens: 120,
  reasoningTokens: 30,
  cachedTokens: 0,
  costUsd: 0.000412,
  responseId: 'gen-abc',
}

const generation: OpenRouterGeneration = {
  id: 'gen-abc',
  model: 'vendor/model-a',
  provider_name: 'Acme',
  latency: 1620,
  generation_time: 1410,
  finish_reason: 'stop',
  tokens_prompt: 800,
  tokens_completion: 110,
  native_tokens_reasoning: 25,
  native_tokens_cached: 5,
  total_cost: 0.0005,
}

const base = {
  task: 'select paragraph 2 → Shorter',
  attempt: 1,
  outcome: 'valid' as const,
  startedAt: '2026-10-28T12:00:00.000Z',
  timing: { clientTotalMs: 1850 },
}

describe('shapeAiCallRecord', () => {
  it('combines telemetry and the generation endpoint into one record', () => {
    expect(shapeAiCallRecord({ ...base, observation, generation })).toEqual({
      startedAt: '2026-10-28T12:00:00.000Z',
      task: 'select paragraph 2 → Shorter',
      attempt: 1,
      outcome: 'valid',
      requestedModel: 'vendor/model-a',
      servedModel: 'vendor/model-a',
      provider: 'Acme',
      tokens: { input: 812, output: 120, reasoning: 30, cached: 0 },
      costUsd: 0.000412,
      latencyMs: {
        client: 1850,
        openRouter: 1620,
        generation: 1410,
        firstElement: null,
        firstSuggestion: null,
      },
      finishReason: 'stop',
      generationId: 'gen-abc',
      error: null,
    })
  })

  it('falls back to telemetry when the generation endpoint is unavailable', () => {
    const record = shapeAiCallRecord({ ...base, observation })
    expect(record.provider).toBe('FromTelemetry')
    expect(record.servedModel).toBe('vendor/model-a-20260101')
    expect(record.latencyMs.openRouter).toBeNull()
    expect(record.latencyMs.generation).toBeNull()
    expect(record.generationId).toBe('gen-abc')
  })

  it('falls back to generation data for missing telemetry fields', () => {
    const record = shapeAiCallRecord({
      ...base,
      observation: { requestedModel: 'vendor/model-a' },
      generation,
    })
    expect(record.tokens).toEqual({
      input: 800,
      output: 110,
      reasoning: 25,
      cached: 5,
    })
    expect(record.costUsd).toBe(0.0005)
    expect(record.finishReason).toBe('stop')
    expect(record.generationId).toBe('gen-abc')
  })

  it('uses null for anything unknown', () => {
    const record = shapeAiCallRecord({
      ...base,
      outcome: 'error',
      observation: { requestedModel: 'vendor/model-a', error: 'out-of-credit' },
    })
    expect(record.tokens).toEqual({
      input: null,
      output: null,
      reasoning: null,
      cached: null,
    })
    expect(record.costUsd).toBeNull()
    expect(record.servedModel).toBeNull()
    expect(record.provider).toBeNull()
    expect(record.finishReason).toBeNull()
    expect(record.generationId).toBeNull()
    expect(record.error).toBe('out-of-credit')
  })

  it('keeps the time to the first Suggestion of a Review pass', () => {
    const record = shapeAiCallRecord({
      ...base,
      task: 'Review pass',
      observation,
      generation,
      timing: {
        clientTotalMs: 4210,
        firstElementMs: 900,
        firstSuggestionMs: 1320,
      },
    })
    expect(record.latencyMs.firstElement).toBe(900)
    expect(record.latencyMs.firstSuggestion).toBe(1320)
  })

  it('marks a retry attempt and an invalid outcome', () => {
    const record = shapeAiCallRecord({
      ...base,
      attempt: 2,
      outcome: 'invalid',
      observation,
    })
    expect(record).toMatchObject({ attempt: 2, outcome: 'invalid' })
  })
})

describe('formatRecordRow', () => {
  const record = shapeAiCallRecord({ ...base, observation, generation })

  it('renders every field of the AI call record', () => {
    const row = formatRecordRow(record)
    expect(row.startsWith('| ')).toBe(true)
    expect(row.endsWith(' |')).toBe(true)
    for (const expected of [
      'select paragraph 2 → Shorter',
      'vendor/model-a',
      'Acme',
      '812 / 120 / 30 / 0',
      '0.000412',
      '1850 / 1620 / 1410',
      'stop',
      'valid',
      'gen-abc',
    ]) {
      expect(row).toContain(expected)
    }
  })

  it('marks unknown values with a dash', () => {
    const row = formatRecordRow(
      shapeAiCallRecord({
        ...base,
        outcome: 'error',
        observation: { requestedModel: 'vendor/model-a' },
      }),
    )
    expect(row).toContain('– / – / – / –')
    expect(row).toContain('error')
  })

  it('shows the time to first Suggestion', () => {
    const row = formatRecordRow(
      shapeAiCallRecord({
        ...base,
        observation,
        generation,
        timing: { clientTotalMs: 4210, firstSuggestionMs: 1320 },
      }),
    )
    expect(row).toContain('first 1320')
  })

  it('escapes pipes and newlines in the task', () => {
    const row = formatRecordRow({ ...record, task: 'a | b\nc' })
    expect(row).toContain('a \\| b c')
    expect(row.split('\n')).toHaveLength(1)
  })

  it('shows the attempt number for a retry', () => {
    expect(formatRecordRow({ ...record, attempt: 2 })).toContain('retry')
  })
})

describe('formatRecordsTable', () => {
  it('renders a header, a separator and one row per record', () => {
    const record = shapeAiCallRecord({ ...base, observation, generation })
    const lines = formatRecordsTable([record, record]).split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]?.startsWith('| Task |')).toBe(true)
    expect(lines[1]).toMatch(/^\|(?: --- \|)+$/)
  })
})
