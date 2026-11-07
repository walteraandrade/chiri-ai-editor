import type { ModelClient } from './client'

const LOAD_FAILED_MESSAGE =
  'part of the app failed to load. Reload the page, then retry.'

type SuggestionClient = Pick<
  ModelClient,
  | 'requestSuggestion'
  | 'refineSuggestion'
  | 'requestDescription'
  | 'reviewDocument'
>

export type LazyModelClient = SuggestionClient & {
  readonly preload: () => void
  readonly reset: () => void
}

const loadFailure = {
  ok: false,
  error: { type: 'unknown', message: LOAD_FAILED_MESSAGE },
} as const

export const createLazyModelClient = (
  load: () => Promise<SuggestionClient>,
): LazyModelClient => {
  let loading: Promise<SuggestionClient> | undefined

  const get = (): Promise<SuggestionClient> => {
    loading ??= load().catch((error: unknown) => {
      loading = undefined
      throw error
    })
    return loading
  }

  return {
    reset: () => {
      loading = undefined
    },
    preload: () => {
      get().catch(() => undefined)
    },
    requestSuggestion: async (request) => {
      const client = await get().catch(() => undefined)
      return client ? client.requestSuggestion(request) : loadFailure
    },
    refineSuggestion: async (request) => {
      const client = await get().catch(() => undefined)
      return client ? client.refineSuggestion(request) : loadFailure
    },
    requestDescription: async (request) => {
      const client = await get().catch(() => undefined)
      return client ? client.requestDescription(request) : loadFailure
    },
    reviewDocument: async function* (request) {
      const client = await get().catch(() => undefined)
      if (client) yield* client.reviewDocument(request)
      else yield { type: 'error', error: loadFailure.error }
    },
  }
}
