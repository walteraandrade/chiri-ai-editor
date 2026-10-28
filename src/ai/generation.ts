import { z } from 'zod'
import type { OpenRouterGeneration } from './records'

const nullableNumber = z.number().nullish()
const nullableString = z.string().nullish()

const generationSchema = z.object({
  data: z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    provider_name: nullableString,
    latency: nullableNumber,
    generation_time: nullableNumber,
    finish_reason: nullableString,
    tokens_prompt: nullableNumber,
    tokens_completion: nullableNumber,
    native_tokens_reasoning: nullableNumber,
    native_tokens_cached: nullableNumber,
    total_cost: nullableNumber,
  }),
})

export const DEFAULT_GENERATION_INITIAL_DELAY_MS = 30_000

export const DEFAULT_GENERATION_DELAYS_MS: readonly number[] = Array.from(
  { length: 24 },
  () => 10_000,
)

export type FetchGenerationOptions = {
  readonly baseURL: string
  readonly apiKey: string
  readonly id: string | undefined
  readonly fetch?: typeof fetch
  readonly initialDelayMs?: number
  readonly delaysMs?: readonly number[]
  readonly sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const attemptOnce = async (
  fetchFn: typeof fetch,
  url: string,
  apiKey: string,
): Promise<OpenRouterGeneration | undefined> => {
  try {
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) return undefined
    const parsed = generationSchema.safeParse(await response.json())
    return parsed.success ? parsed.data.data : undefined
  } catch {
    return undefined
  }
}

export const fetchGeneration = async ({
  baseURL,
  apiKey,
  id,
  fetch: fetchFn = fetch,
  initialDelayMs = DEFAULT_GENERATION_INITIAL_DELAY_MS,
  delaysMs = DEFAULT_GENERATION_DELAYS_MS,
  sleep = defaultSleep,
}: FetchGenerationOptions): Promise<OpenRouterGeneration | undefined> => {
  if (id === undefined) return undefined
  const url = `${baseURL}/generation?id=${encodeURIComponent(id)}`
  if (initialDelayMs > 0) await sleep(initialDelayMs)
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    const generation = await attemptOnce(fetchFn, url, apiKey)
    if (generation) return generation
    const delay = delaysMs[attempt]
    if (delay !== undefined) await sleep(delay)
  }
  return undefined
}
