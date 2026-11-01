import type { AcceptedChange, VersionCause } from './types'

type Fields = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null

const isString = (value: unknown): value is string => typeof value === 'string'

const isChange = (value: unknown): value is AcceptedChange =>
  isRecord(value) &&
  (value.origin === 'ask' || value.origin === 'review') &&
  isString(value.instruction) &&
  isString(value.rationale)

export const isCause = (value: unknown): value is VersionCause => {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'started':
    case 'edited':
    case 'external':
      return true
    case 'accepted':
      return Array.isArray(value.changes) && value.changes.every(isChange)
    case 'opened':
      return isString(value.name)
    case 'restored':
      return Number.isInteger(value.from)
    default:
      return false
  }
}
