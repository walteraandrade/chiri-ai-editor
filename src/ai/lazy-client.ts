import type { ModelClient } from './client'

type SuggestionClient = Pick<ModelClient, 'requestSuggestion'>

export const createLazyModelClient = (
  load: () => Promise<SuggestionClient>,
): SuggestionClient => {
  let loading: Promise<SuggestionClient> | undefined

  const get = (): Promise<SuggestionClient> => {
    loading ??= load().catch((error: unknown) => {
      loading = undefined
      throw error
    })
    return loading
  }

  return {
    requestSuggestion: async (request) => {
      try {
        return await (await get()).requestSuggestion(request)
      } catch (error) {
        return {
          ok: false,
          error: {
            type: 'network',
            message: error instanceof Error ? error.message : String(error),
          },
        }
      }
    },
  }
}
