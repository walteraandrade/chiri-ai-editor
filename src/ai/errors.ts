import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'

export type ClientError =
  | { readonly type: 'out-of-credit'; readonly message: string }
  | { readonly type: 'rate-limited'; readonly message: string }
  | { readonly type: 'timeout'; readonly message: string }
  | { readonly type: 'aborted'; readonly message: string }
  | { readonly type: 'network'; readonly message: string }
  | { readonly type: 'invalid-output'; readonly message: string }
  | {
      readonly type: 'api'
      readonly status: number
      readonly message: string
    }
  | { readonly type: 'unknown'; readonly message: string }

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ClientError }

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const payloadStatus = (data: unknown): number | undefined => {
  if (typeof data !== 'object' || data === null) return undefined
  const code = (data as { code?: unknown }).code
  return typeof code === 'number' ? code : undefined
}

const fromStatus = (status: number, message: string): ClientError =>
  status === 402
    ? { type: 'out-of-credit', message }
    : status === 429
      ? { type: 'rate-limited', message }
      : { type: 'api', status, message }

const isSuccessStatus = (status: number): boolean =>
  status >= 200 && status < 300

const fromApiCallError = (error: APICallError): ClientError => {
  const status =
    error.statusCode === undefined || isSuccessStatus(error.statusCode)
      ? (payloadStatus(error.data) ?? error.statusCode)
      : error.statusCode
  if (status === undefined) return { type: 'network', message: error.message }
  return isSuccessStatus(status)
    ? { type: 'unknown', message: 'the answer stream broke off. Retry.' }
    : fromStatus(status, error.message)
}

const fromDirectError = (error: unknown): ClientError | undefined => {
  if (RetryError.isInstance(error)) return classifyError(error.lastError)
  if (APICallError.isInstance(error)) return fromApiCallError(error)
  if (NoObjectGeneratedError.isInstance(error))
    return { type: 'invalid-output', message: error.message }
  if (error instanceof Error && error.name === 'TimeoutError')
    return { type: 'timeout', message: error.message }
  if (error instanceof Error && error.name === 'AbortError')
    return { type: 'aborted', message: error.message }
  if (error instanceof TypeError && /fetch/i.test(error.message))
    return { type: 'network', message: error.message }
  return undefined
}

export const classifyError = (error: unknown): ClientError => {
  const direct = fromDirectError(error)
  if (direct) return direct
  if (error instanceof Error && error.cause !== undefined) {
    const nested = classifyError(error.cause)
    if (nested.type !== 'unknown') return nested
  }
  return { type: 'unknown', message: messageOf(error) }
}

export const isRetryableOutputError = (error: ClientError): boolean =>
  error.type === 'invalid-output'
