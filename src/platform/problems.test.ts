import { describe, expect, it, vi } from 'vitest'
import { createProblems, problemMessage } from './problems'

describe('createProblems', () => {
  it('announces a failure to a subscriber', () => {
    const problems = createProblems()
    const listener = vi.fn()
    problems.subscribe(listener)
    problems.failed('history')
    expect(listener).toHaveBeenCalledExactlyOnceWith('history')
  })

  it('announces a failure streak once, however many writes fail', () => {
    const problems = createProblems()
    const listener = vi.fn()
    problems.subscribe(listener)
    for (let index = 0; index < 20; index += 1) problems.failed('unsaved')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('announces again after a write went through', () => {
    const problems = createProblems()
    const listener = vi.fn()
    problems.subscribe(listener)
    problems.failed('history')
    problems.worked('history')
    problems.failed('history')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps each kind of failure apart', () => {
    const problems = createProblems()
    const listener = vi.fn()
    problems.subscribe(listener)
    problems.failed('history')
    problems.failed('unsaved')
    problems.worked('history')
    problems.failed('unsaved')
    expect(listener.mock.calls).toEqual([['history'], ['unsaved']])
  })

  it('tells a late subscriber about a failure nobody heard yet', () => {
    const problems = createProblems()
    problems.failed('history')
    const listener = vi.fn()
    problems.subscribe(listener)
    expect(listener).toHaveBeenCalledExactlyOnceWith('history')
  })

  it('does not repeat an announced failure to a later subscriber', () => {
    const problems = createProblems()
    problems.subscribe(() => undefined)
    problems.failed('history')
    const late = vi.fn()
    problems.subscribe(late)
    expect(late).not.toHaveBeenCalled()
  })

  it('stops announcing to a subscriber that unsubscribed', () => {
    const problems = createProblems()
    const listener = vi.fn()
    const unsubscribe = problems.subscribe(listener)
    unsubscribe()
    problems.failed('history')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('problemMessage', () => {
  it('says what could not be saved', () => {
    expect(problemMessage('history')).toBe('History could not be saved.')
    expect(problemMessage('unsaved')).toBe(
      'Your unsaved text could not be saved.',
    )
  })
})
