import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createModelClient, type ModelClient } from '../src/ai/client'
import { FALLBACK_MODEL } from '../src/ai/default-model'
import {
  type AiCallLogTarget,
  appendAiCall,
  enrichAiCall,
} from '../src/ai/dev-log'
import type { ClientError } from '../src/ai/errors'
import { getQuickAction, type QuickActionId } from '../src/ai/quick-actions'
import type { AiCallRecord } from '../src/ai/records'
import { extractBlocks } from '../src/blocks/extract-blocks'
import { getNeighbors, resolveTarget } from '../src/blocks/target'
import { SAMPLE_DOCUMENT } from '../src/document/sample-document'
import {
  costsRow,
  type ModelRun,
  type RequestResult,
  type RequestSpec,
  renderBakeoffReport,
  summarizeModel,
} from './bakeoff-report'

const MODELS: readonly string[] = [
  'z-ai/glm-5.3-flash',
  'deepseek/deepseek-v4.1-flash',
  'qwen/qwen3.8-flash',
  'google/gemini-3.5-flash-lite',
  'google/gemini-3.8-flash',
  'google/gemini-4-argon',
  'anthropic/claude-haiku-5.5',
  'openai/gpt-6.1-terra',
  'anthropic/claude-sonnet-5.5',
]

const BUDGET_USD = 0.5
const STOP_BEFORE_USD = 0.45
const FIRST_CALL_ESTIMATE_USD = 0.01
const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_OUT = 'docs/chiri/bakeoff.md'

type QuickPlan = {
  readonly action: QuickActionId
  readonly blockId: string
  readonly marker: string
}

const QUICK_PLANS: readonly QuickPlan[] = [
  {
    action: 'shorter',
    blockId: 'p3',
    marker: 'frozen all production deployments',
  },
  { action: 'clearer', blockId: 'p8', marker: 'Rollback plan' },
  { action: 'more-formal', blockId: 'p5', marker: 'lol' },
  { action: 'fix-grammar', blockId: 'p12', marker: 'recieve' },
]

type Args = {
  readonly dryRun: boolean
  readonly models: readonly string[]
  readonly requestIds: readonly string[] | undefined
  readonly out: string
  readonly json: string | undefined
  readonly waitForStats: boolean
}

const parseArgs = (argv: readonly string[]): Args => {
  const flag = (name: string): string | undefined =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const dryRun = argv.includes('--dry-run')
  const models = flag('models')?.split(',').filter(Boolean)
  const requestIds = flag('requests')?.split(',').filter(Boolean)
  return {
    dryRun,
    models: models ?? (dryRun ? [FALLBACK_MODEL] : MODELS),
    requestIds: requestIds ?? (dryRun ? ['shorter'] : undefined),
    out: flag('out') ?? DEFAULT_OUT,
    json: flag('json'),
    waitForStats: !argv.includes('--no-stats'),
  }
}

const loadEnvFile = (): void => {
  if (existsSync('.env')) process.loadEnvFile('.env')
}

const blocks = extractBlocks(SAMPLE_DOCUMENT)

const requireBlock = (id: string, marker: string) => {
  const block = blocks.find((candidate) => candidate.id === id)
  if (!block?.text.includes(marker))
    throw new Error(
      `The sample Document changed: ${id} no longer has "${marker}"`,
    )
  return block
}

const buildSpecs = (): readonly RequestSpec[] => [
  ...QUICK_PLANS.map(({ action, blockId, marker }) => ({
    id: action,
    label: getQuickAction(action).label,
    kind: 'quick' as const,
    blockId,
    original: requireBlock(blockId, marker).text,
  })),
  { id: 'review', label: 'Review pass', kind: 'review' as const },
]

const taskLabel = (spec: RequestSpec): string =>
  spec.kind === 'quick'
    ? `Bake-off: ${spec.label} on ${spec.blockId}`
    : 'Bake-off: Review pass (no Focus)'

const quickRequest = (spec: RequestSpec) => {
  const block = requireBlock(spec.blockId ?? '', '')
  const target = resolveTarget(blocks, SAMPLE_DOCUMENT, {
    from: block.from + 1,
    to: block.from + 1,
  })
  if (!target) throw new Error(`No Target for ${spec.id}`)
  return {
    target,
    neighbors: getNeighbors(blocks, target),
    instruction: getQuickAction(spec.id as QuickActionId).instruction,
    task: taskLabel(spec),
  }
}

const runQuick = async (
  client: ModelClient,
  spec: RequestSpec,
): Promise<RequestResult> => {
  const started = performance.now()
  const result = await client.requestSuggestion(quickRequest(spec))
  const wallMs = Math.round(performance.now() - started)
  return {
    requestId: spec.id,
    task: taskLabel(spec),
    wallMs,
    outcome: result.ok
      ? { type: 'suggestion', payload: result.value }
      : { type: 'error', error: result.error },
  }
}

const runReview = async (
  client: ModelClient,
  spec: RequestSpec,
): Promise<RequestResult> => {
  const started = performance.now()
  const edits: { blockId: string; replacement: string; rationale: string }[] =
    []
  const dropped: { blockId: string; reason: string }[] = []
  let done:
    | {
        attempts: number
        incomplete: boolean
        firstSuggestionMs: number | null
      }
    | undefined
  let error: ClientError | undefined
  for await (const event of client.reviewDocument({
    blocks,
    task: taskLabel(spec),
  })) {
    if (event.type === 'edit')
      edits.push({
        blockId: event.edit.blockId,
        replacement: event.edit.replacement,
        rationale: event.edit.rationale,
      })
    else if (event.type === 'dropped')
      dropped.push({ blockId: event.edit.blockId, reason: event.reason })
    else if (event.type === 'done') done = event
    else error = event.error
  }
  const wallMs = Math.round(performance.now() - started)
  return {
    requestId: spec.id,
    task: taskLabel(spec),
    wallMs,
    outcome:
      done === undefined
        ? {
            type: 'error',
            error: error ?? { type: 'unknown', message: 'No result' },
          }
        : {
            type: 'review',
            payload: {
              edits,
              dropped,
              attempts: done.attempts,
              incomplete: done.incomplete,
              firstSuggestionMs: done.firstSuggestionMs,
            },
          },
  }
}

const sumCost = (records: readonly AiCallRecord[]): number =>
  records.reduce((total, record) => total + (record.costUsd ?? 0), 0)

const describe = (result: RequestResult): string => {
  switch (result.outcome.type) {
    case 'error':
      return `FAILED ${result.outcome.error.type}: ${result.outcome.error.message.slice(0, 120)}`
    case 'skipped':
      return `skipped (${result.outcome.reason})`
    case 'review':
      return `${result.outcome.payload.edits.length} edits, first at ${result.outcome.payload.firstSuggestionMs ?? '-'} ms`
    default:
      return result.outcome.payload.unchanged ? 'unchanged' : 'ok'
  }
}

const main = async (): Promise<void> => {
  loadEnvFile()
  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  const allSpecs = buildSpecs()
  const specs = args.requestIds
    ? allSpecs.filter((spec) => args.requestIds?.includes(spec.id))
    : allSpecs
  if (specs.length === 0) throw new Error('No matching requests')

  const logs = new Map<string, AiCallLogTarget>()
  const recordsOf = (model: string): readonly AiCallRecord[] =>
    logs.get(model)?.__aiCalls ?? []
  const spent = (): number =>
    sumCost(args.models.flatMap((model) => recordsOf(model)))
  const clients: ModelClient[] = []
  const results = new Map<string, RequestResult[]>()
  let budgetExhausted = false

  for (const model of args.models) {
    const log: AiCallLogTarget = {}
    logs.set(model, log)
    const client = createModelClient({
      baseURL: OPENROUTER_URL,
      apiKey,
      model,
      onRecord: (record) => appendAiCall(log, record),
      ...(args.waitForStats
        ? { onRecordEnriched: (record) => enrichAiCall(log, record) }
        : {}),
    })
    clients.push(client)
    const modelResults: RequestResult[] = []
    results.set(model, modelResults)
    for (const spec of specs) {
      const estimate = Math.max(
        FIRST_CALL_ESTIMATE_USD,
        ...recordsOf(model).map((record) => record.costUsd ?? 0),
      )
      if (budgetExhausted || spent() + estimate > STOP_BEFORE_USD) {
        budgetExhausted = true
        modelResults.push({
          requestId: spec.id,
          task: taskLabel(spec),
          wallMs: 0,
          outcome: { type: 'skipped', reason: 'budget guard' },
        })
        continue
      }
      const result = await (spec.kind === 'quick'
        ? runQuick(client, spec)
        : runReview(client, spec)
      ).catch(
        (error: unknown): RequestResult => ({
          requestId: spec.id,
          task: taskLabel(spec),
          wallMs: 0,
          outcome: {
            type: 'error',
            error: {
              type: 'unknown',
              message: error instanceof Error ? error.message : String(error),
            },
          },
        }),
      )
      await client.recorded()
      modelResults.push(result)
      console.log(
        `${model.padEnd(32)} ${spec.id.padEnd(12)} ${String(result.wallMs).padStart(6)} ms  ${describe(result)}  (spent US$${spent().toFixed(4)})`,
      )
    }
  }

  if (args.waitForStats)
    console.log(
      '\nWaiting for the OpenRouter generation stats, which lag about a minute...',
    )
  await Promise.all(clients.map((client) => client.flush()))
  const runs: ModelRun[] = args.models.map((model) => ({
    model,
    results: results.get(model) ?? [],
    records: recordsOf(model),
  }))
  const allRecords = runs.flatMap((run) => run.records)

  const summaries = runs.map((run) => summarizeModel(run, specs))
  const total = sumCost(allRecords)
  console.log(
    `\nTotal cost: US$${total.toFixed(6)} of ${BUDGET_USD.toFixed(2)}`,
  )
  console.log('\nai-costs.md rows:')
  const date = new Date().toISOString().slice(0, 10)
  for (const summary of summaries) console.log(costsRow(date, summary))

  if (args.json) {
    await mkdir(dirname(resolve(args.json)), { recursive: true })
    await writeFile(
      resolve(args.json),
      JSON.stringify({ date, specs, runs }, null, 2),
    )
  }
  if (args.dryRun) {
    console.log('\nDry run, nothing written. Records:')
    console.log(JSON.stringify(allRecords, null, 2))
    return
  }
  const report = renderBakeoffReport({
    date,
    documentName: 'sample Document',
    specs,
    runs,
    budgetUsd: BUDGET_USD,
    blocks,
  })
  const out = resolve(args.out)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, report)
  console.log(`\nWrote ${args.out}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
