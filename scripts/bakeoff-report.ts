import type { ClientError } from '../src/ai/errors'
import { type AiCallRecord, formatRecordsTable } from '../src/ai/records'
import type { Block } from '../src/blocks/extract-blocks'

export const DRAFT_REOPEN_THRESHOLD_MS = 3000

export type RequestSpec = {
  readonly id: string
  readonly label: string
  readonly kind: 'quick' | 'review'
  readonly blockId?: string
  readonly original?: string
}

export type SuggestionPayload = {
  readonly replacement: string
  readonly rationale: string
  readonly unchanged: boolean
}

export type ReviewPayload = {
  readonly edits: readonly {
    readonly blockId: string
    readonly replacement: string
    readonly rationale: string
  }[]
  readonly dropped: readonly {
    readonly blockId: string
    readonly reason: string
  }[]
  readonly attempts: number
  readonly incomplete: boolean
  readonly firstSuggestionMs: number | null
}

export type RequestOutcome =
  | { readonly type: 'suggestion'; readonly payload: SuggestionPayload }
  | { readonly type: 'review'; readonly payload: ReviewPayload }
  | { readonly type: 'error'; readonly error: ClientError }
  | { readonly type: 'skipped'; readonly reason: string }

export type RequestResult = {
  readonly requestId: string
  readonly task: string
  readonly wallMs: number
  readonly outcome: RequestOutcome
}

export type ModelRun = {
  readonly model: string
  readonly results: readonly RequestResult[]
  readonly records: readonly AiCallRecord[]
}

export type BakeoffInput = {
  readonly date: string
  readonly documentName: string
  readonly specs: readonly RequestSpec[]
  readonly runs: readonly ModelRun[]
  readonly budgetUsd: number
  readonly blocks?: readonly Pick<Block, 'id' | 'kind' | 'text'>[]
}

export type ModelSummary = {
  readonly model: string
  readonly providers: readonly string[]
  readonly targetMedianMs: number | null
  readonly perRequestMs: Readonly<Record<string, number | null>>
  readonly reviewMs: number | null
  readonly reviewFirstSuggestionMs: number | null
  readonly reviewEdits: number
  readonly costUsd: number
  readonly tokens: {
    readonly input: number
    readonly output: number
    readonly reasoning: number
    readonly cached: number
  }
  readonly finishReasons: Readonly<Record<string, number>>
  readonly rationales: number
  readonly foreignRationales: number
  readonly requests: number
  readonly succeeded: number
  readonly firstTryValid: number
  readonly retries: number
  readonly failures: number
  readonly skipped: number
  readonly slow: boolean
}

const FOREIGN_MARKERS: ReadonlySet<string> = new Set(
  [
    'le la les de des du et en un une pour dans qui est sont que ce cette sur sans ou',
    'el los las del y una para con se por como es su sus',
    'der das und ist nicht ein eine zu mit von wird werden für auf dem den',
    'og som det på er av med för och att het een van voor zijn',
    'os uma um não em',
  ].flatMap((line) => line.split(' ')),
)

export const likelyNotEnglish = (text: string): boolean => {
  const hasForeignLetter = [...text].some(
    (char) => char.charCodeAt(0) > 127 && /\p{L}/u.test(char),
  )
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? []
  const hasForeignQuotes = /[«»„]/.test(text)
  return (
    hasForeignLetter ||
    hasForeignQuotes ||
    words.some((word) => FOREIGN_MARKERS.has(word))
  )
}

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] as number
  return sorted.length % 2 === 1
    ? upper
    : ((sorted[middle - 1] as number) + upper) / 2
}

export const fence = (text: string): string => {
  const longest = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length),
  )
  const marker = '`'.repeat(Math.max(3, longest + 1))
  return `${marker}\n${text}\n${marker}`
}

const sum = (values: readonly (number | null)[]): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0)

const unique = <T>(values: readonly T[]): readonly T[] => [...new Set(values)]

const isSuccess = (result: RequestResult): boolean =>
  result.outcome.type === 'suggestion' || result.outcome.type === 'review'

const countBy = (values: readonly string[]): Readonly<Record<string, number>> =>
  Object.fromEntries(
    unique(values).map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  )

const firstRecordOf = (
  records: readonly AiCallRecord[],
  task: string,
): AiCallRecord | undefined =>
  records
    .filter((record) => record.task === task)
    .sort((a, b) => a.attempt - b.attempt)[0]

const rationalesOf = (run: ModelRun): readonly string[] =>
  run.results.flatMap((result) =>
    result.outcome.type === 'suggestion'
      ? [result.outcome.payload.rationale]
      : result.outcome.type === 'review'
        ? result.outcome.payload.edits.map((edit) => edit.rationale)
        : [],
  )

export const summarizeModel = (
  run: ModelRun,
  specs: readonly RequestSpec[],
): ModelSummary => {
  const kindOf = (requestId: string) =>
    specs.find((spec) => spec.id === requestId)?.kind
  const attempted = run.results.filter(
    (result) => result.outcome.type !== 'skipped',
  )
  const quickSuccesses = run.results.filter(
    (result) => kindOf(result.requestId) === 'quick' && isSuccess(result),
  )
  const review = run.results.find(
    (result) => kindOf(result.requestId) === 'review' && isSuccess(result),
  )
  const reviewPayload =
    review?.outcome.type === 'review' ? review.outcome.payload : undefined
  const targetMedianMs = median(quickSuccesses.map((result) => result.wallMs))
  return {
    model: run.model,
    providers: unique(
      run.records.flatMap((record) =>
        record.provider === null ? [] : [record.provider],
      ),
    ),
    targetMedianMs,
    perRequestMs: Object.fromEntries(
      run.results.map((result) => [
        result.requestId,
        isSuccess(result) ? result.wallMs : null,
      ]),
    ),
    reviewMs: review?.wallMs ?? null,
    reviewFirstSuggestionMs: reviewPayload?.firstSuggestionMs ?? null,
    reviewEdits: reviewPayload?.edits.length ?? 0,
    costUsd: sum(run.records.map((record) => record.costUsd)),
    tokens: {
      input: sum(run.records.map((record) => record.tokens.input)),
      output: sum(run.records.map((record) => record.tokens.output)),
      reasoning: sum(run.records.map((record) => record.tokens.reasoning)),
      cached: sum(run.records.map((record) => record.tokens.cached)),
    },
    finishReasons: countBy(
      run.records.flatMap((record) =>
        record.finishReason === null ? [] : [record.finishReason],
      ),
    ),
    rationales: rationalesOf(run).length,
    foreignRationales: rationalesOf(run).filter(likelyNotEnglish).length,
    requests: run.results.length,
    succeeded: run.results.filter(isSuccess).length,
    firstTryValid: attempted.filter(
      (result) => firstRecordOf(run.records, result.task)?.outcome === 'valid',
    ).length,
    retries: run.records.filter((record) => record.attempt > 1).length,
    failures: run.results.filter((result) => result.outcome.type === 'error')
      .length,
    skipped: run.results.filter((result) => result.outcome.type === 'skipped')
      .length,
    slow: targetMedianMs !== null && targetMedianMs > DRAFT_REOPEN_THRESHOLD_MS,
  }
}

const ms = (value: number | null): string =>
  value === null ? '–' : String(Math.round(value))

const usd = (value: number): string => value.toFixed(4)

const code = (text: string): string => `\`${text}\``

const summaryTable = (
  summaries: readonly ModelSummary[],
  specs: readonly RequestSpec[],
): string => {
  const quick = specs.filter((spec) => spec.kind === 'quick')
  const headers = [
    'Model',
    'Served by',
    'Target median (ms)',
    ...quick.map((spec) => `${spec.label} (ms)`),
    'Review total (ms)',
    'Review first Suggestion (ms)',
    'Review edits',
    'Cost (US$)',
    'OK',
    'Valid first try',
    'Retries',
    'Failures',
    'Rationale not in English',
  ]
  const rows = summaries.map((summary) => [
    code(summary.model),
    summary.providers.join(', ') || '–',
    summary.slow
      ? `**${ms(summary.targetMedianMs)}** (above ~3 s)`
      : ms(summary.targetMedianMs),
    ...quick.map((spec) => ms(summary.perRequestMs[spec.id] ?? null)),
    ms(summary.reviewMs),
    ms(summary.reviewFirstSuggestionMs),
    String(summary.reviewEdits),
    usd(summary.costUsd),
    `${summary.succeeded}/${summary.requests}`,
    `${summary.firstTryValid}/${summary.requests - summary.skipped}`,
    String(summary.retries),
    summary.skipped > 0
      ? `${summary.failures} (+${summary.skipped} skipped)`
      : String(summary.failures),
    `${summary.foreignRationales}/${summary.rationales}`,
  ])
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => ' --- |').join('')}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const reopenRule = (summaries: readonly ModelSummary[]): string => {
  const slow = summaries.filter((summary) => summary.slow)
  return [
    '## Draft reopen rule',
    '',
    `[ADR 0008](adr/0008-validated-streaming-only.md): if the chosen model's median Target-request latency is above ~${DRAFT_REOPEN_THRESHOLD_MS / 1000} s, the Draft preview is reopened. Median of the 4 Quick actions, client wall time including a silent retry when there was one.`,
    '',
    ...(slow.length === 0
      ? ['No model is above the threshold.']
      : slow.map(
          (summary) =>
            `- ${code(summary.model)}: median ${ms(summary.targetMedianMs)} ms, above ~3 s`,
        )),
  ].join('\n')
}

const describeOutcome = (result: RequestResult): string => {
  switch (result.outcome.type) {
    case 'error':
      return `failed: ${result.outcome.error.type} (${result.outcome.error.message})`
    case 'skipped':
      return `skipped (${result.outcome.reason})`
    default:
      return `${ms(result.wallMs)} ms`
  }
}

const quickSection = (spec: RequestSpec, runs: readonly ModelRun[]): string => {
  const entries = runs.map((run) => {
    const result = run.results.find(
      (candidate) => candidate.requestId === spec.id,
    )
    const heading = `#### ${code(run.model)}`
    if (!result) return `${heading}\n\nno result`
    const status = describeOutcome(result)
    if (result.outcome.type !== 'suggestion') return `${heading}\n\n${status}`
    const { replacement, rationale, unchanged } = result.outcome.payload
    return [
      `${heading} (${status}${unchanged ? ', unchanged' : ''})`,
      '',
      fence(replacement),
      '',
      `Rationale${likelyNotEnglish(rationale) ? ' (not in English)' : ''}: ${rationale}`,
    ].join('\n')
  })
  return [
    `### ${spec.label} (${spec.blockId ?? '–'})`,
    '',
    '**Original**',
    '',
    fence(spec.original ?? ''),
    '',
    ...entries.flatMap((entry) => [entry, '']),
  ].join('\n')
}

const reviewPayloadOf = (
  run: ModelRun,
  spec: RequestSpec,
): ReviewPayload | undefined => {
  const result = run.results.find(
    (candidate) => candidate.requestId === spec.id,
  )
  return result?.outcome.type === 'review' ? result.outcome.payload : undefined
}

const reviewMatrix = (
  spec: RequestSpec,
  runs: readonly ModelRun[],
  blocks: BakeoffInput['blocks'],
): string => {
  const edited = (run: ModelRun): ReadonlySet<string> =>
    new Set(reviewPayloadOf(run, spec)?.edits.map((edit) => edit.blockId))
  const rows =
    blocks ??
    unique(runs.flatMap((run) => [...edited(run)])).map((id) => ({
      id,
      kind: '',
      text: '',
    }))
  const headers = ['Block', 'Kind', ...runs.map((run) => code(run.model))]
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => ' --- |').join('')}`,
    ...rows.map(
      (block) =>
        `| ${block.id} | ${block.kind} | ${runs
          .map((run) => (edited(run).has(block.id) ? 'edited' : ''))
          .join(' | ')} |`,
    ),
  ].join('\n')
}

const reviewSection = (
  spec: RequestSpec,
  runs: readonly ModelRun[],
  blocks: BakeoffInput['blocks'],
): string => {
  const entries = runs.map((run) => {
    const result = run.results.find(
      (candidate) => candidate.requestId === spec.id,
    )
    const heading = `#### ${code(run.model)}`
    if (!result) return `${heading}\n\nno result`
    const status = describeOutcome(result)
    const payload = reviewPayloadOf(run, spec)
    if (!payload) return `${heading}\n\n${status}`
    const first =
      payload.firstSuggestionMs === null
        ? ''
        : `, first Suggestion at ${ms(payload.firstSuggestionMs)} ms`
    const flags = [
      payload.attempts > 1 ? 'retried once' : '',
      payload.incomplete ? 'output cut short' : '',
    ].filter(Boolean)
    return [
      `${heading} (${status}${first}${flags.length ? `, ${flags.join(', ')}` : ''})`,
      '',
      ...(payload.edits.length === 0
        ? ['No edits.', '']
        : payload.edits.flatMap((edit) => [
            `**${edit.blockId}**${likelyNotEnglish(edit.rationale) ? ' (rationale not in English)' : ''}: ${edit.rationale}`,
            '',
            fence(edit.replacement),
            '',
          ])),
      ...(payload.dropped.length === 0
        ? []
        : [
            `Dropped by the app: ${payload.dropped
              .map((drop) => `${drop.blockId} (${drop.reason})`)
              .join(', ')}`,
            '',
          ]),
    ].join('\n')
  })
  const originals = (blocks ?? []).length
    ? [
        '<details>',
        '<summary>Document Blocks sent to the models</summary>',
        '',
        ...(blocks ?? []).flatMap((block) => [
          `**${block.id}** (${block.kind})`,
          '',
          fence(block.text),
          '',
        ]),
        '</details>',
        '',
      ]
    : []
  return [
    `### ${spec.label}`,
    '',
    'Blocks each model chose to edit:',
    '',
    reviewMatrix(spec, runs, blocks),
    '',
    ...originals,
    ...entries.flatMap((entry) => [entry, '']),
  ].join('\n')
}

export const renderBakeoffReport = ({
  date,
  documentName,
  specs,
  runs,
  budgetUsd,
  blocks,
}: BakeoffInput): string => {
  const summaries = runs.map((run) => summarizeModel(run, specs))
  const total = sum(summaries.map((summary) => summary.costUsd))
  const quick = specs.filter((spec) => spec.kind === 'quick')
  const review = specs.filter((spec) => spec.kind === 'review')
  const records = runs.flatMap((run) => run.records)
  return [
    '# Bake-off',
    '',
    `Run on ${date} by \`pnpm bakeoff\`, which uses the same client and prompts as the app ([ADR 0010](adr/0010-model-bakeoff.md)).`,
    '',
    `- Input: the ${documentName}; ${quick.length} Quick actions on fixed Targets plus ${review.length} Review pass without Focus.`,
    '- Settings for every model: strict JSON schema, `provider.require_parameters: true`, reasoning effort `low`, 30 s timeout for Target requests and 60 s for the Review pass, one silent retry on invalid output, models called one after another.',
    '- The sample Document is English, so a Rationale in another language is a slip of the model (rule 5 of [ADR 0006](adr/0006-context-and-prompt-rules.md)). "Rationale not in English" is a heuristic count, read the outputs to confirm.',
    '- Latencies are client wall time per request, including the silent retry when there was one. Cost comes from the OpenRouter `usage.cost` of each call.',
    `- **Total cost: US$${usd(total)}** of the US$${budgetUsd.toFixed(2)} Bake-off budget.`,
    '',
    '## Summary',
    '',
    summaryTable(summaries, specs),
    '',
    reopenRule(summaries),
    '',
    '## Quick actions',
    '',
    ...quick.flatMap((spec) => [quickSection(spec, runs), '']),
    '## Review pass',
    '',
    ...review.flatMap((spec) => [reviewSection(spec, runs, blocks), '']),
    '## All AI call records',
    '',
    '<details>',
    '<summary>One row per model call, retries included</summary>',
    '',
    formatRecordsTable(records),
    '',
    '</details>',
    '',
  ].join('\n')
}

const finishCell = (
  finishReasons: Readonly<Record<string, number>>,
): string => {
  const entries = Object.entries(finishReasons)
  return entries.length === 0
    ? '–'
    : entries.map(([reason, count]) => `${reason} ×${count}`).join(', ')
}

export const costsRow = (date: string, summary: ModelSummary): string => {
  const cells = [
    date,
    '#2',
    'Bake-off: 4 Quick actions + Review pass',
    `${code(summary.model)} → ${summary.providers.join(', ') || '–'}`,
    `${summary.tokens.input} / ${summary.tokens.output} / ${summary.tokens.reasoning} / ${summary.tokens.cached}`,
    summary.costUsd.toFixed(6),
    `${ms(summary.targetMedianMs)} / ${ms(summary.reviewMs)} (median Target / Review)`,
    finishCell(summary.finishReasons),
    `${summary.succeeded}/${summary.requests}${summary.retries ? `, ${summary.retries} retry` : ', no retries'}`,
    '[bakeoff.md](chiri/bakeoff.md)',
  ]
  return `| ${cells.join(' | ')} |`
}
