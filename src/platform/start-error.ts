const FALLBACK_MESSAGE = 'Unknown error'

export const startErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message.trim() : ''
  return message === '' ? FALLBACK_MESSAGE : message
}
