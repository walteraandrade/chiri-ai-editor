import { describe, expect, it } from 'vitest'
import { formatAgo, formatClock } from './time'

const MINUTE = 60_000
const NOW = 10_000 * MINUTE

describe('formatAgo', () => {
  it('says just now under a minute', () => {
    expect(formatAgo(NOW - 59_000, NOW)).toBe('just now')
  })

  it('counts minutes, then hours, then days', () => {
    expect(formatAgo(NOW - 3 * MINUTE, NOW)).toBe('3 min ago')
    expect(formatAgo(NOW - 125 * MINUTE, NOW)).toBe('2 h ago')
    expect(formatAgo(NOW - 24 * 60 * MINUTE, NOW)).toBe('1 day ago')
    expect(formatAgo(NOW - 3 * 24 * 60 * MINUTE, NOW)).toBe('3 days ago')
  })

  it('treats a time in the future as just now', () => {
    expect(formatAgo(NOW + MINUTE, NOW)).toBe('just now')
  })
})

describe('formatClock', () => {
  const today = new Date(2026, 9, 30, 15, 0).getTime()
  const timeOnly = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  it('shows only the time for a moment of the same day', () => {
    const at = new Date(2026, 9, 30, 8, 54).getTime()
    expect(formatClock(at, today)).toBe(timeOnly(at))
  })

  it('adds the date for an earlier day', () => {
    const at = new Date(2026, 9, 29, 8, 54).getTime()
    expect(formatClock(at, today)).not.toBe(timeOnly(at))
    expect(formatClock(at, today).length).toBeGreaterThan(timeOnly(at).length)
  })
})
