export const FALLBACK_MODEL = 'openai/gpt-6.1-terra'

export const resolveModel = (configured: string | undefined): string => {
  const trimmed = configured?.trim()
  return trimmed ? trimmed : FALLBACK_MODEL
}
