import type { VersionCause, VersionId } from './types'

export type ThinCandidate = {
  readonly id: VersionId
  readonly at: number
  readonly kind: VersionCause['kind']
  readonly saved: boolean
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const HOURLY_AFTER_MS = 7 * DAY_MS
const DAILY_AFTER_MS = 90 * DAY_MS

const bucketOf = (age: number, at: number): number | undefined =>
  age >= DAILY_AFTER_MS
    ? Math.floor(at / DAY_MS) * 2
    : age >= HOURLY_AFTER_MS
      ? Math.floor(at / HOUR_MS) * 2 + 1
      : undefined

export const idsToThin = (
  versions: readonly ThinCandidate[],
  now: number,
): readonly VersionId[] => {
  const newest = versions.reduce((max, { id }) => Math.max(max, id), 0)
  const thinnable = versions.filter(
    ({ kind, saved }) => kind === 'edited' && !saved,
  )
  const lastInBucket = thinnable.reduce<ReadonlyMap<number, VersionId>>(
    (kept, { id, at }) => {
      const bucket = bucketOf(now - at, at)
      return bucket === undefined
        ? kept
        : new Map(kept).set(bucket, Math.max(id, kept.get(bucket) ?? 0))
    },
    new Map(),
  )
  return thinnable
    .filter(({ id, at }) => {
      const bucket = bucketOf(now - at, at)
      return (
        id !== newest && bucket !== undefined && lastInBucket.get(bucket) !== id
      )
    })
    .map(({ id }) => id)
}
