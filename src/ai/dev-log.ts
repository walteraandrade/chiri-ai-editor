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

export const enrichAiCall = (
  target: AiCallLogTarget,
  record: AiCallRecord,
): void => {
  const log = target.__aiCalls ?? []
  const index = log.findIndex(
    (entry) =>
      entry.generationId !== null && entry.generationId === record.generationId,
  )
  if (index === -1) log.push(record)
  else log[index] = record
  target.__aiCalls = log
}

export type ReviewDropEntry = {
  readonly blockId: string
  readonly reason: string
}

export type ReviewDropLogTarget = { __reviewDrops?: ReviewDropEntry[] }

export const appendReviewDrop = (
  target: ReviewDropLogTarget,
  drop: ReviewDropEntry,
): void => {
  const log = target.__reviewDrops ?? []
  log.push(drop)
  target.__reviewDrops = log
}
