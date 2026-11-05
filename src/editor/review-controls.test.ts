import { describe, expect, it, vi } from 'vitest'
import { beforeReviewChanges, type ReviewControls } from './review-controls'

const createControls = (calls: string[]): ReviewControls => ({
  start: (focus) => calls.push(`start:${focus}`),
  stop: () => calls.push('stop'),
  acceptAll: () => calls.push('acceptAll'),
  rejectAll: () => calls.push('rejectAll'),
})

describe('beforeReviewChanges', () => {
  it('runs the hook before a pass starts and before Accept all or Reject all', () => {
    const calls: string[] = []
    const controls = beforeReviewChanges(createControls(calls), () =>
      calls.push('before'),
    )
    controls.start('tone')
    controls.acceptAll()
    controls.rejectAll()
    expect(calls).toEqual([
      'before',
      'start:tone',
      'before',
      'acceptAll',
      'before',
      'rejectAll',
    ])
  })

  it('leaves Stop alone', () => {
    const before = vi.fn()
    const controls = beforeReviewChanges(createControls([]), before)
    controls.stop()
    expect(before).not.toHaveBeenCalled()
  })
})
