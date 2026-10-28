import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateId, generateText, Output, streamText } from 'ai'
import type { Block } from '../blocks/extract-blocks'
import {
  checkSuggestion,
  type DropReason,
  initialReviewState,
  type SuggestionResult,
  type ValidatedEdit,
  validateReviewEdit,
} from './edits'
import {
  type ClientError,
  classifyError,
  isRetryableOutputError,
  type Result,
} from './errors'
import { fetchGeneration } from './generation'
import {
  buildRefinePrompt,
  buildReviewPrompt,
  buildTargetPrompt,
  type PromptParts,
  type RefinePromptInput,
  type TargetPromptInput,
} from './prompts'
import {
  type AiCallRecord,
  type CallObservation,
  type CallOutcome,
  type OpenRouterGeneration,
  shapeAiCallRecord,
} from './records'
import { type ReviewEdit, reviewEditSchema, suggestionSchema } from './schemas'
import { getSharedTelemetryCollector } from './telemetry'

export type ReasoningSetting =
  | 'default'
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'

export type RequestKindLimits = {
  readonly target: number
  readonly review: number
}

export type ModelClientConfig = {
  readonly baseURL: string
  readonly apiKey: string
  readonly model: string
  readonly fetch?: typeof fetch
  readonly reasoning?: ReasoningSetting
  readonly maxRetries?: number
  readonly timeoutsMs?: RequestKindLimits
  readonly maxOutputTokens?: RequestKindLimits
  readonly onRecord?: (record: AiCallRecord) => void
  readonly onRecordEnriched?: (record: AiCallRecord) => void
  readonly generationInitialDelayMs?: number
  readonly generationDelaysMs?: readonly number[]
  readonly clock?: () => number
}

export const DEFAULT_TIMEOUTS_MS: RequestKindLimits = {
  target: 30_000,
  review: 30_000,
}

export const DEFAULT_MAX_OUTPUT_TOKENS: RequestKindLimits = {
  target: 4096,
  review: 8192,
}

export const DEFAULT_MAX_RETRIES = 1

type RequestOptions = {
  readonly task?: string
  readonly signal?: AbortSignal
}

export type TargetRequest = TargetPromptInput & RequestOptions
export type RefineRequest = RefinePromptInput & RequestOptions
export type ReviewRequest = RequestOptions & {
  readonly blocks: readonly Block[]
  readonly focus?: string
  readonly occupied?: ReadonlySet<string>
}

export type ReviewEvent =
  | {
      readonly type: 'edit'
      readonly edit: ValidatedEdit
      readonly elapsedMs: number
    }
  | {
      readonly type: 'dropped'
      readonly edit: ReviewEdit
      readonly reason: DropReason
    }
  | {
      readonly type: 'done'
      readonly validated: number
      readonly dropped: number
      readonly attempts: number
      readonly incomplete: boolean
      readonly firstSuggestionMs: number | null
    }
  | { readonly type: 'error'; readonly error: ClientError }

export type ModelClient = {
  readonly model: string
  readonly requestSuggestion: (
    request: TargetRequest,
  ) => Promise<Result<SuggestionResult>>
  readonly refineSuggestion: (
    request: RefineRequest,
  ) => Promise<Result<SuggestionResult>>
  readonly reviewDocument: (
    request: ReviewRequest,
  ) => AsyncGenerator<ReviewEvent, void>
  readonly recorded: () => Promise<void>
  readonly flush: () => Promise<void>
}

type AttemptSummary = {
  readonly validated: number
  readonly dropped: number
  readonly firstSuggestionSinceStartMs: number | null
  readonly failure: ClientError | undefined
}

const outcomeOf = (failure: ClientError | undefined): CallOutcome =>
  failure === undefined
    ? 'valid'
    : failure.type === 'invalid-output'
      ? 'invalid'
      : 'error'

const safely = (callback: () => void): void => {
  try {
    callback()
  } catch {
    return
  }
}

const combineSignals = (
  external: AbortSignal | undefined,
  internal: AbortSignal,
): AbortSignal =>
  external === undefined ? internal : AbortSignal.any([external, internal])

export const createModelClient = (config: ModelClientConfig): ModelClient => {
  const {
    baseURL,
    apiKey,
    model,
    reasoning = 'low',
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutsMs = DEFAULT_TIMEOUTS_MS,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    clock = () => performance.now(),
  } = config
  const provider = createOpenRouter({
    baseURL,
    apiKey,
    fetch: config.fetch,
    compatibility: 'strict',
  })
  const collector = getSharedTelemetryCollector()
  const pendingRecords = new Set<Promise<void>>()
  const pendingEnrichment = new Set<Promise<void>>()

  const buildModel = () =>
    provider.chat(model, {
      provider: { require_parameters: true },
      structuredOutputs: { strict: true },
      ...(reasoning === 'default' ? {} : { reasoning: { effort: reasoning } }),
    })

  const track = (set: Set<Promise<void>>, work: Promise<void>): void => {
    set.add(work)
    work.finally(() => set.delete(work))
  }

  const drain = async (set: ReadonlySet<Promise<void>>): Promise<void> => {
    while (set.size > 0) await Promise.all([...set])
  }

  type Attempt = {
    readonly requestId: string
    readonly observation: Promise<CallObservation>
    readonly startedAt: string
    readonly startedMs: number
  }

  const startAttempt = (): Attempt => {
    const requestId = generateId()
    return {
      requestId,
      observation: collector.expect(requestId, model),
      startedAt: new Date().toISOString(),
      startedMs: clock(),
    }
  }

  const settleAttempt = (
    attempt: Attempt,
    meta: {
      readonly task: string
      readonly number: number
      readonly failure: ClientError | undefined
      readonly firstElementMs?: number
      readonly firstSuggestionMs?: number
    },
  ): void => {
    const clientTotalMs = Math.round(clock() - attempt.startedMs)
    collector.release(attempt.requestId)
    const shape = (
      observation: CallObservation,
      generation?: OpenRouterGeneration,
    ): AiCallRecord =>
      shapeAiCallRecord({
        task: meta.task,
        attempt: meta.number,
        outcome: outcomeOf(meta.failure),
        startedAt: attempt.startedAt,
        timing: {
          clientTotalMs,
          firstElementMs: meta.firstElementMs,
          firstSuggestionMs: meta.firstSuggestionMs,
        },
        observation: {
          ...observation,
          requestedModel: model,
          error: meta.failure?.type,
        },
        generation,
      })
    const recorded = attempt.observation.then((observation) => {
      safely(() => config.onRecord?.(shape(observation)))
      return observation
    })
    track(
      pendingRecords,
      recorded.then(() => undefined),
    )
    if (config.onRecordEnriched === undefined) return
    const enrich = config.onRecordEnriched
    track(
      pendingEnrichment,
      recorded.then(async (observation) => {
        const generation = await fetchGeneration({
          baseURL,
          apiKey,
          id: observation.responseId,
          fetch: config.fetch,
          initialDelayMs: config.generationInitialDelayMs,
          delaysMs: config.generationDelaysMs,
        })
        if (generation) safely(() => enrich(shape(observation, generation)))
      }),
    )
  }

  const callSettings = (
    attempt: Attempt,
    task: string,
    kind: keyof RequestKindLimits,
    abortSignal: AbortSignal | undefined,
  ) => ({
    model: buildModel(),
    maxRetries,
    maxOutputTokens: maxOutputTokens[kind],
    timeout: { totalMs: timeoutsMs[kind] },
    abortSignal,
    runtimeContext: { requestId: attempt.requestId },
    telemetry: {
      functionId: task,
      includeRuntimeContext: { requestId: true },
    },
  })

  const runTargetAttempt = async (
    parts: PromptParts,
    original: string,
    task: string,
    number: number,
    signal: AbortSignal | undefined,
  ): Promise<Result<SuggestionResult>> => {
    const attempt = startAttempt()
    try {
      const result = await generateText({
        ...callSettings(attempt, task, 'target', signal),
        instructions: parts.instructions,
        prompt: parts.prompt,
        output: Output.object({ schema: suggestionSchema }),
      })
      const check = checkSuggestion(original, result.output)
      if (check.type === 'invalid') {
        const failure: ClientError = {
          type: 'invalid-output',
          message: `The replacement was ${check.reason}`,
        }
        settleAttempt(attempt, { task, number, failure })
        return { ok: false, error: failure }
      }
      settleAttempt(attempt, { task, number, failure: undefined })
      return { ok: true, value: check.suggestion }
    } catch (error) {
      const failure = classifyError(error)
      settleAttempt(attempt, { task, number, failure })
      return { ok: false, error: failure }
    }
  }

  const runTarget = async (
    parts: PromptParts,
    original: string,
    task: string,
    signal: AbortSignal | undefined,
  ): Promise<Result<SuggestionResult>> => {
    const first = await runTargetAttempt(parts, original, task, 1, signal)
    return first.ok || !isRetryableOutputError(first.error)
      ? first
      : runTargetAttempt(parts, original, task, 2, signal)
  }

  async function* reviewAttempt(
    request: ReviewRequest,
    task: string,
    number: number,
    overallStartMs: number,
  ): AsyncGenerator<ReviewEvent, AttemptSummary> {
    const attempt = startAttempt()
    const parts = buildReviewPrompt(request)
    const context = {
      blocks: request.blocks,
      occupied: request.occupied ?? new Set<string>(),
    }
    const controller = new AbortController()
    const streamErrors: unknown[] = []
    let state = initialReviewState
    let validated = 0
    let dropped = 0
    let firstElementMs: number | undefined
    let firstSuggestionMs: number | undefined
    let firstSuggestionSinceStartMs: number | undefined
    let failure: ClientError | undefined
    let completed = false
    try {
      const result = streamText({
        ...callSettings(
          attempt,
          task,
          'review',
          combineSignals(request.signal, controller.signal),
        ),
        instructions: parts.instructions,
        prompt: parts.prompt,
        output: Output.array({ element: reviewEditSchema }),
        onError: ({ error }) => {
          streamErrors.push(error)
        },
      })
      for await (const element of result.elementStream) {
        firstElementMs ??= Math.round(clock() - attempt.startedMs)
        const step = validateReviewEdit(context, state, element)
        state = step.state
        if (step.outcome.type === 'validated') {
          validated += 1
          firstSuggestionMs ??= Math.round(clock() - attempt.startedMs)
          firstSuggestionSinceStartMs ??= Math.round(clock() - overallStartMs)
          yield {
            type: 'edit',
            edit: step.outcome.edit,
            elapsedMs: Math.round(clock() - overallStartMs),
          }
        } else {
          dropped += 1
          yield {
            type: 'dropped',
            edit: element,
            reason: step.outcome.reason,
          }
        }
      }
      await result.output
      completed = true
    } catch (error) {
      failure = classifyError(streamErrors[0] ?? error)
    } finally {
      if (!completed) controller.abort()
      settleAttempt(attempt, {
        task,
        number,
        failure: completed
          ? undefined
          : (failure ?? { type: 'aborted', message: 'Stopped by the caller' }),
        firstElementMs,
        firstSuggestionMs,
      })
    }
    return {
      validated,
      dropped,
      firstSuggestionSinceStartMs: firstSuggestionSinceStartMs ?? null,
      failure,
    }
  }

  async function* reviewDocument(
    request: ReviewRequest,
  ): AsyncGenerator<ReviewEvent, void> {
    const task = request.task ?? 'Review pass'
    const overallStartMs = clock()
    const first = yield* reviewAttempt(request, task, 1, overallStartMs)
    const retry =
      first.failure !== undefined &&
      first.validated === 0 &&
      isRetryableOutputError(first.failure)
    const last = retry
      ? yield* reviewAttempt(request, task, 2, overallStartMs)
      : first
    if (last.failure !== undefined && last.validated === 0) {
      yield { type: 'error', error: last.failure }
      return
    }
    yield {
      type: 'done',
      validated: last.validated,
      dropped: last.dropped,
      attempts: retry ? 2 : 1,
      incomplete: last.failure !== undefined,
      firstSuggestionMs: last.firstSuggestionSinceStartMs,
    }
  }

  return {
    model,
    requestSuggestion: (request) =>
      runTarget(
        buildTargetPrompt(request),
        request.target.text,
        request.task ?? `Target request: ${request.instruction}`,
        request.signal,
      ),
    refineSuggestion: (request) =>
      runTarget(
        buildRefinePrompt(request),
        request.target.text,
        request.task ?? `Refine: ${request.instruction}`,
        request.signal,
      ),
    reviewDocument,
    recorded: () => drain(pendingRecords),
    flush: async () => {
      await drain(pendingRecords)
      await drain(pendingEnrichment)
    },
  }
}
