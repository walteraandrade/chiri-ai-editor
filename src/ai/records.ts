export type CallObservation = {
  readonly requestedModel: string
  readonly servedModel?: string
  readonly provider?: string
  readonly finishReason?: string
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly reasoningTokens?: number
  readonly cachedTokens?: number
  readonly costUsd?: number
  readonly responseId?: string
  readonly error?: string
}

export type OpenRouterGeneration = {
  readonly id?: string
  readonly model?: string
  readonly provider_name?: string | null
  readonly latency?: number | null
  readonly generation_time?: number | null
  readonly finish_reason?: string | null
  readonly tokens_prompt?: number | null
  readonly tokens_completion?: number | null
  readonly native_tokens_reasoning?: number | null
  readonly native_tokens_cached?: number | null
  readonly total_cost?: number | null
}

export type CallTiming = {
  readonly clientTotalMs: number
  readonly firstElementMs?: number
  readonly firstSuggestionMs?: number
}

export type CallOutcome = 'valid' | 'invalid' | 'error'

export type AiCallRecord = {
  readonly startedAt: string
  readonly task: string
  readonly attempt: number
  readonly outcome: CallOutcome
  readonly requestedModel: string
  readonly servedModel: string | null
  readonly provider: string | null
  readonly tokens: {
    readonly input: number | null
    readonly output: number | null
    readonly reasoning: number | null
    readonly cached: number | null
  }
  readonly costUsd: number | null
  readonly latencyMs: {
    readonly client: number
    readonly openRouter: number | null
    readonly generation: number | null
    readonly firstElement: number | null
    readonly firstSuggestion: number | null
  }
  readonly finishReason: string | null
  readonly generationId: string | null
  readonly error: string | null
}

export type ShapeRecordInput = {
  readonly task: string
  readonly attempt: number
  readonly outcome: CallOutcome
  readonly startedAt: string
  readonly observation: CallObservation
  readonly generation?: OpenRouterGeneration
  readonly timing: CallTiming
}

const firstDefined = <T>(
  ...values: readonly (T | null | undefined)[]
): T | null => values.find((value) => value != null) ?? null

export const shapeAiCallRecord = ({
  task,
  attempt,
  outcome,
  startedAt,
  observation,
  generation,
  timing,
}: ShapeRecordInput): AiCallRecord => ({
  startedAt,
  task,
  attempt,
  outcome,
  requestedModel: observation.requestedModel,
  servedModel: firstDefined(generation?.model, observation.servedModel),
  provider: firstDefined(generation?.provider_name, observation.provider),
  tokens: {
    input: firstDefined(observation.inputTokens, generation?.tokens_prompt),
    output: firstDefined(
      observation.outputTokens,
      generation?.tokens_completion,
    ),
    reasoning: firstDefined(
      observation.reasoningTokens,
      generation?.native_tokens_reasoning,
    ),
    cached: firstDefined(
      observation.cachedTokens,
      generation?.native_tokens_cached,
    ),
  },
  costUsd: firstDefined(observation.costUsd, generation?.total_cost),
  latencyMs: {
    client: timing.clientTotalMs,
    openRouter: firstDefined(generation?.latency),
    generation: firstDefined(generation?.generation_time),
    firstElement: firstDefined(timing.firstElementMs),
    firstSuggestion: firstDefined(timing.firstSuggestionMs),
  },
  finishReason: firstDefined(
    generation?.finish_reason,
    observation.finishReason,
  ),
  generationId: firstDefined(observation.responseId, generation?.id),
  error: firstDefined(observation.error),
})

const DASH = '–'

const cell = (value: string): string =>
  value.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

const show = (value: number | string | null): string =>
  value === null ? DASH : String(value)

const formatCost = (cost: number | null): string =>
  cost === null ? DASH : cost.toFixed(6)

const formatLatency = ({ latencyMs }: AiCallRecord): string => {
  const base = [latencyMs.client, latencyMs.openRouter, latencyMs.generation]
    .map(show)
    .join(' / ')
  return latencyMs.firstSuggestion === null
    ? base
    : `${base} (first ${latencyMs.firstSuggestion})`
}

const formatOutcome = (record: AiCallRecord): string => {
  const retry = record.attempt > 1 ? ' (retry)' : ''
  return `${record.outcome}${retry}${record.error ? `: ${record.error}` : ''}`
}

export const RECORD_TABLE_COLUMNS: readonly string[] = [
  'Task',
  'Model requested',
  'Served by',
  'Tokens in / out / reasoning / cached',
  'Cost (US$)',
  'Latency client / OpenRouter / generation (ms)',
  'Finish',
  'Valid',
  'Generation id',
]

export const formatRecordRow = (record: AiCallRecord): string => {
  const served = [record.servedModel, record.provider]
    .filter((part) => part !== null)
    .join(' · ')
  const cells = [
    record.task,
    record.requestedModel,
    served === '' ? DASH : served,
    [
      record.tokens.input,
      record.tokens.output,
      record.tokens.reasoning,
      record.tokens.cached,
    ]
      .map(show)
      .join(' / '),
    formatCost(record.costUsd),
    formatLatency(record),
    show(record.finishReason),
    formatOutcome(record),
    show(record.generationId),
  ]
  return `| ${cells.map(cell).join(' | ')} |`
}

export const formatRecordsTable = (records: readonly AiCallRecord[]): string =>
  [
    `| ${RECORD_TABLE_COLUMNS.join(' | ')} |`,
    `|${RECORD_TABLE_COLUMNS.map(() => ' --- |').join('')}`,
    ...records.map(formatRecordRow),
  ].join('\n')
