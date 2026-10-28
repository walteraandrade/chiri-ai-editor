export const FALLBACK_MODEL = 'deepseek/deepseek-v4.1-flash'

export const resolveModel = (configured: string | undefined): string => {
  const trimmed = configured?.trim()
  return trimmed ? trimmed : FALLBACK_MODEL
}
