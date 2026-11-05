import { describe, expect, it } from 'vitest'
import { idsToThin, type ThinCandidate } from './thin'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = 200 * DAY

const edited = (id: number, at: number): ThinCandidate => ({
  id,
  at,
  kind: 'edited',
  saved: false,
})

describe('idsToThin', () => {
  it('keeps every Version younger than 7 days', () => {
    const versions = [1, 2, 3, 4].map((id) =>
      edited(id, NOW - DAY - id * 60_000),
    )
    expect(idsToThin(versions, NOW)).toEqual([])
  })

  it('keeps the last Edited Version of each hour between 7 and 90 days', () => {
    const base = NOW - 10 * DAY
    const versions = [
      edited(1, base),
      edited(2, base + 10 * 60_000),
      edited(3, base + 20 * 60_000),
      edited(4, base + HOUR),
    ]
    expect(idsToThin(versions, NOW)).toEqual([1, 2])
  })

  it('keeps the last Edited Version of each day after 90 days', () => {
    const base = NOW - 120 * DAY
    const versions = [
      edited(1, base),
      edited(2, base + 3 * HOUR),
      edited(3, base + 5 * HOUR),
      edited(4, base + DAY),
    ]
    expect(idsToThin(versions, NOW)).toEqual([1, 2])
  })

  it('never thins a Version that is not Edited, or that was saved', () => {
    const base = NOW - 10 * DAY
    const versions: ThinCandidate[] = [
      { id: 1, at: base, kind: 'accepted', saved: false },
      { id: 2, at: base + 1000, kind: 'external', saved: false },
      { id: 3, at: base + 2000, kind: 'edited', saved: true },
      { id: 4, at: base + 3000, kind: 'restored', saved: false },
      { id: 5, at: base + 4000, kind: 'opened', saved: false },
      edited(6, base + 5000),
    ]
    expect(idsToThin(versions, NOW)).toEqual([])
  })

  it('never thins the newest Version', () => {
    const base = NOW - 10 * DAY
    expect(idsToThin([edited(1, base), edited(2, base + 1000)], NOW)).toEqual([
      1,
    ])
    expect(idsToThin([edited(1, base), edited(2, base + HOUR)], NOW)).toEqual(
      [],
    )
  })

  it('thins around a saved Version and keeps the saved one', () => {
    const base = NOW - 10 * DAY
    const versions: ThinCandidate[] = [
      edited(1, base),
      { id: 2, at: base + 1000, kind: 'edited', saved: true },
      edited(3, base + 2000),
      edited(4, base + 3000),
    ]
    expect(idsToThin(versions, NOW)).toEqual([1, 3])
  })
})
