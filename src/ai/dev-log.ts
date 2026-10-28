import type { AiCallRecord } from './records'

export type AiCallLogTarget = { __aiCalls?: AiCallRecord[] }

export const appendAiCall = (
  target: AiCallLogTarget,
  record: AiCallRecord,
): void => {
  const log = target.__aiCalls ?? []
  log.push(record)
  target.__aiCalls = log
}
