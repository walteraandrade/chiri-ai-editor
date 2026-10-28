import { registerTelemetry, type Telemetry } from 'ai'
import { z } from 'zod'
import type { CallObservation } from './records'

const openRouterMetadataSchema = z.object({
  provider: z.string().optional(),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
})

const requestIdSchema = z.object({ requestId: z.string() })

const DEFAULT_GRACE_MS = 2000

type Entry = {
  readonly requestedModel: string
  readonly observation: Partial<CallObservation>
  readonly settle: (observation: CallObservation) => void
  readonly startGrace: () => void
}

export type TelemetryCollector = {
  readonly integration: Telemetry
  readonly expect: (
    requestId: string,
    requestedModel: string,
  ) => Promise<CallObservation>
  readonly release: (requestId: string) => void
}

const requestIdOf = (event: unknown): string | undefined => {
  if (typeof event !== 'object' || event === null) return undefined
  const parsed = requestIdSchema.safeParse(
    (event as { runtimeContext?: unknown }).runtimeContext,
  )
  return parsed.success ? parsed.data.requestId : undefined
}

const callIdOf = (event: unknown): string | undefined =>
  typeof event === 'object' && event !== null
    ? ((event as { callId?: unknown }).callId as string | undefined)
    : undefined

const errorMessageOf = (event: unknown): string => {
  const error =
    typeof event === 'object' && event !== null
      ? (event as { error?: unknown }).error
      : undefined
  return error instanceof Error ? error.message : String(error ?? 'unknown')
}

const complete = (entry: Entry): CallObservation => ({
  ...entry.observation,
  requestedModel: entry.requestedModel,
})

export const createTelemetryCollector = (
  graceMs = DEFAULT_GRACE_MS,
): TelemetryCollector => {
  const entries = new Map<string, Entry>()
  const requestByCall = new Map<string, string>()

  const update = (
    requestId: string | undefined,
    patch: Partial<CallObservation>,
    finish = false,
  ): void => {
    const entry = requestId === undefined ? undefined : entries.get(requestId)
    if (requestId === undefined || entry === undefined) return
    const next: Entry = {
      ...entry,
      observation: { ...entry.observation, ...patch },
    }
    if (finish) next.settle(complete(next))
    else entries.set(requestId, next)
  }

  const integration: Telemetry = {
    onStart: (event) => {
      const requestId = requestIdOf(event)
      if (requestId === undefined) return
      requestByCall.set(event.callId, requestId)
    },
    onLanguageModelCallEnd: (event) => {
      const metadata = openRouterMetadataSchema.safeParse(
        event.providerMetadata?.openrouter,
      )
      const openRouter = metadata.success ? metadata.data : undefined
      update(requestByCall.get(event.callId), {
        servedModel: event.modelId,
        finishReason: event.finishReason,
        responseId: event.responseId,
        ...(openRouter?.provider ? { provider: openRouter.provider } : {}),
        ...(openRouter?.usage?.cost === undefined
          ? {}
          : { costUsd: openRouter.usage.cost }),
        ...(event.usage.inputTokens === undefined
          ? {}
          : { inputTokens: event.usage.inputTokens }),
        ...(event.usage.outputTokens === undefined
          ? {}
          : { outputTokens: event.usage.outputTokens }),
        ...(event.usage.outputTokenDetails.reasoningTokens === undefined
          ? {}
          : {
              reasoningTokens: event.usage.outputTokenDetails.reasoningTokens,
            }),
        ...(event.usage.inputTokenDetails.cacheReadTokens === undefined
          ? {}
          : { cachedTokens: event.usage.inputTokenDetails.cacheReadTokens }),
      })
    },
    onEnd: (event) => {
      update(requestByCall.get(event.callId), {}, true)
      requestByCall.delete(event.callId)
    },
    onAbort: (event) => {
      update(requestByCall.get(event.callId), { error: 'aborted' }, true)
      requestByCall.delete(event.callId)
    },
    onError: (event) => {
      const callId = callIdOf(event)
      if (callId === undefined) return
      update(requestByCall.get(callId), { error: errorMessageOf(event) }, true)
      requestByCall.delete(callId)
    },
  }

  const expect = (
    requestId: string,
    requestedModel: string,
  ): Promise<CallObservation> =>
    new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const settle = (observation: CallObservation): void => {
        clearTimeout(timer)
        entries.delete(requestId)
        resolve(observation)
      }
      const startGrace = (): void => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const entry = entries.get(requestId)
          settle(entry ? complete(entry) : { requestedModel })
        }, graceMs)
      }
      entries.set(requestId, {
        requestedModel,
        observation: {},
        settle,
        startGrace,
      })
    })

  const release = (requestId: string): void => {
    entries.get(requestId)?.startGrace()
  }

  return { integration, expect, release }
}

let sharedCollector: TelemetryCollector | undefined

export const getSharedTelemetryCollector = (): TelemetryCollector => {
  if (sharedCollector === undefined) {
    sharedCollector = createTelemetryCollector()
    registerTelemetry(sharedCollector.integration)
  }
  return sharedCollector
}
