import { describe, expect, it } from 'vitest'
import { shortCommit } from './build-info.ts'

describe('shortCommit', () => {
  it('keeps the first 7 characters of a commit hash', () => {
    expect(shortCommit('75086b946c1d38a8764adbea5955de1a006a9697\n')).toBe(
      '75086b9',
    )
  })

  it('says unknown when there is no hash', () => {
    expect(shortCommit('')).toBe('unknown')
    expect(shortCommit(null)).toBe('unknown')
    expect(shortCommit('not a hash')).toBe('unknown')
  })
})
