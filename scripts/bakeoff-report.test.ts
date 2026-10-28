import { describe, expect, it } from 'vitest'
import { type AiCallRecord, shapeAiCallRecord } from '../src/ai/records'
import {
  type BakeoffInput,
  costsRow,
  fence,
  likelyNotEnglish,
  type ModelRun,
  median,
  type RequestResult,
  type RequestSpec,
  renderBakeoffReport,
  summarizeModel,
} from './bakeoff-report'

const record = (overrides: {
  task: string
  model: string
  attempt?: number
  outcome?: 'valid' | 'invalid' | 'error'
  costUsd?: number
  provider?: string
  clientMs?: number
  firstSuggestionMs?: number
}): AiCallRecord =>
  shapeAiCallRecord({
    task: overrides.task,
    attempt: overrides.attempt ?? 1,
    outcome: overrides.outcome ?? 'valid',
    startedAt: '2026-10-28T12:00:00.000Z',
    observation: {
      requestedModel: overrides.model,
      servedModel: overrides.model,
      provider: overrides.provider ?? 'Acme',
      finishReason: 'stop',
      inputTokens: 100,
      outputTokens: 20,
      reasoningTokens: 5,
      cachedTokens: 0,
      costUsd: overrides.costUsd ?? 0.001,
      responseId: 'gen-1',
    },
    timing: {
      clientTotalMs: overrides.clientMs ?? 1000,
      firstSuggestionMs: overrides.firstSuggestionMs,
    },
  })

const specs: readonly RequestSpec[] = [
  {
    id: 'shorter',
    label: 'Shorter',
    kind: 'quick',
    blockId: 'p3',
    original: 'Original three.',
  },
  {
    id: 'fix-grammar',
    label: 'Fix grammar',
    kind: 'quick',
    blockId: 'p12',
    original: 'Original twelve.',
  },
  { id: 'review', label: 'Review pass', kind: 'review' },
]

const taskOf = (spec: RequestSpec) => `Bake-off: ${spec.label}`

const suggestionResult = (
  spec: RequestSpec,
  wallMs: number,
  replacement = 'Short.',
): RequestResult => ({
  requestId: spec.id,
  task: taskOf(spec),
  wallMs,
  outcome: {
    type: 'suggestion',
    payload: { replacement, rationale: 'Tighter.', unchanged: false },
  },
})

const reviewResult = (wallMs: number): RequestResult => ({
  requestId: 'review',
  task: 'Bake-off: Review pass',
  wallMs,
  outcome: {
    type: 'review',
    payload: {
      edits: [
        { blockId: 'p3', replacement: 'Edited three.', rationale: 'Clearer.' },
      ],
      dropped: [{ blockId: 'p99', reason: 'unknown-block' }],
      attempts: 1,
      incomplete: false,
      firstSuggestionMs: 2100,
    },
  },
})

const fastRun: ModelRun = {
  model: 'vendor/fast',
  results: [
    suggestionResult(specs[0] as RequestSpec, 900),
    suggestionResult(specs[1] as RequestSpec, 1500),
    reviewResult(6000),
  ],
  records: [
    record({
      task: 'Bake-off: Shorter',
      model: 'vendor/fast',
      clientMs: 900,
      costUsd: 0.001,
    }),
    record({
      task: 'Bake-off: Fix grammar',
      model: 'vendor/fast',
      clientMs: 1500,
      costUsd: 0.002,
    }),
    record({
      task: 'Bake-off: Review pass',
      model: 'vendor/fast',
      clientMs: 6000,
      costUsd: 0.004,
      provider: 'Other',
      firstSuggestionMs: 2100,
    }),
  ],
}

const slowRun: ModelRun = {
  model: 'vendor/slow',
  results: [
    suggestionResult(specs[0] as RequestSpec, 4200, 'Slow short.'),
    {
      requestId: 'fix-grammar',
      task: 'Bake-off: Fix grammar',
      wallMs: 30000,
      outcome: {
        type: 'error',
        error: { type: 'timeout', message: 'timed out' },
      },
    },
    {
      requestId: 'review',
      task: 'Bake-off: Review pass',
      wallMs: 0,
      outcome: { type: 'skipped', reason: 'budget' },
    },
  ],
  records: [
    record({
      task: 'Bake-off: Shorter',
      model: 'vendor/slow',
      attempt: 1,
      outcome: 'invalid',
      clientMs: 2000,
      costUsd: 0.01,
    }),
    record({
      task: 'Bake-off: Shorter',
      model: 'vendor/slow',
      attempt: 2,
      clientMs: 2200,
      costUsd: 0.01,
    }),
    record({
      task: 'Bake-off: Fix grammar',
      model: 'vendor/slow',
      outcome: 'error',
      clientMs: 30000,
      costUsd: 0,
    }),
  ],
}

const input: BakeoffInput = {
  date: '2026-10-28',
  documentName: 'sample Document',
  specs,
  runs: [fastRun, slowRun],
  budgetUsd: 0.5,
}

describe('median', () => {
  it('returns the middle value of an odd list', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the middle pair of an even list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('returns null for an empty list', () => {
    expect(median([])).toBeNull()
  })
})

describe('likelyNotEnglish', () => {
  it('accepts English rationales', () => {
    for (const text of [
      'Fixes the spelling of "receive".',
      'Corrected spelling errors.',
      'Replaces casual phrasing with a professional tone, while keeping the “same” meaning.',
    ])
      expect(likelyNotEnglish(text)).toBe(false)
  })

  it('flags French, Spanish, German, Norwegian and Russian rationales', () => {
    for (const text of [
      'Corrige la faute de frappe « recieve ».',
      'Corregido el error ortográfico de recieve.',
      'Der Satz ist übermäßig lang.',
      'Straffer formulert setning som fjerner fyll og gjentakelser.',
      'Эти правки сокращают абзац.',
    ])
      expect(likelyNotEnglish(text)).toBe(true)
  })
})

describe('fence', () => {
  it('wraps text in a code fence', () => {
    expect(fence('hello')).toBe('```\nhello\n```')
  })

  it('uses a longer fence than any backtick run inside the text', () => {
    const text = 'a\n```bash\nx\n```\nb'
    const result = fence(text)
    expect(result.startsWith('````\n')).toBe(true)
    expect(result.endsWith('\n````')).toBe(true)
  })
})

describe('summarizeModel', () => {
  it('computes latency, cost, validity and providers for a clean run', () => {
    const summary = summarizeModel(fastRun, specs)
    expect(summary).toMatchObject({
      model: 'vendor/fast',
      targetMedianMs: 1200,
      reviewMs: 6000,
      reviewFirstSuggestionMs: 2100,
      requests: 3,
      succeeded: 3,
      firstTryValid: 3,
      retries: 0,
      failures: 0,
      reviewEdits: 1,
      slow: false,
    })
    expect(summary.costUsd).toBeCloseTo(0.007)
    expect(summary.providers).toEqual(['Acme', 'Other'])
    expect(summary.tokens).toEqual({
      input: 300,
      output: 60,
      reasoning: 15,
      cached: 0,
    })
    expect(summary.perRequestMs).toEqual({
      shorter: 900,
      'fix-grammar': 1500,
      review: 6000,
    })
  })

  it('counts retries, failures and skipped requests, and flags a slow median', () => {
    const summary = summarizeModel(slowRun, specs)
    expect(summary).toMatchObject({
      targetMedianMs: 4200,
      requests: 3,
      succeeded: 1,
      firstTryValid: 0,
      retries: 1,
      failures: 1,
      skipped: 1,
      slow: true,
      reviewMs: null,
    })
    expect(summary.costUsd).toBeCloseTo(0.02)
  })
})

describe('renderBakeoffReport', () => {
  const report = renderBakeoffReport(input)

  it('starts with a summary table with one row per model', () => {
    expect(report).toContain('| Model |')
    expect(report).toContain('| `vendor/fast` |')
    expect(report).toContain('| `vendor/slow` |')
  })

  it('flags models whose median Target request is above 3 s', () => {
    expect(report).toMatch(/Draft reopen rule/)
    const flagged = report
      .split('\n')
      .filter((line) => line.startsWith('- ') && line.includes('vendor/slow'))
    expect(flagged.length).toBeGreaterThan(0)
    expect(report).not.toMatch(/- `vendor\/fast`.*above/)
  })

  it('shows the original and every model output for each Quick action', () => {
    expect(report).toContain('Shorter')
    expect(report).toContain('Original three.')
    expect(report).toContain('Short.')
    expect(report).toContain('Slow short.')
    expect(report).toContain('Tighter.')
  })

  it('shows failures and skips instead of output', () => {
    expect(report).toMatch(/timeout/)
    expect(report).toMatch(/skipped/i)
  })

  it('lists the Review pass edits by blockId', () => {
    expect(report).toContain('p3')
    expect(report).toContain('Edited three.')
    expect(report).toContain('unknown-block')
  })

  it('appends the per-call records', () => {
    expect(report).toContain('Generation id')
    expect(report).toContain('gen-1')
  })

  it('reports the total cost against the budget', () => {
    expect(report).toMatch(/0\.027/)
    expect(report).toMatch(/0\.50/)
  })
})

describe('costsRow', () => {
  it('aggregates one model into an ai-costs.md row', () => {
    const row = costsRow('2026-10-28', summarizeModel(fastRun, specs))
    expect(row.startsWith('| 2026-10-28 |')).toBe(true)
    expect(row).toContain('Bake-off: 4 Quick actions + Review pass')
    expect(row).toContain('vendor/fast')
    expect(row).toContain('300 / 60 / 15 / 0')
    expect(row).toContain('0.007000')
    expect(row).toContain('1200 / 6000')
    expect(row).toContain('[bakeoff.md](chiri/bakeoff.md)')
  })
})
