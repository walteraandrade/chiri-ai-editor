import { describe, expect, it } from 'vitest'
import { isCause } from './cause'

describe('isCause', () => {
  it('accepts every Cause', () => {
    const causes: readonly unknown[] = [
      { kind: 'started' },
      { kind: 'edited' },
      { kind: 'external' },
      { kind: 'opened', name: 'notes.md' },
      { kind: 'restored', from: 3 },
      {
        kind: 'accepted',
        changes: [{ origin: 'ask', instruction: 'Shorter', rationale: 'Why.' }],
      },
    ]
    expect(causes.every(isCause)).toBe(true)
  })

  it('rejects unknown kinds and malformed fields', () => {
    const causes: readonly unknown[] = [
      null,
      'edited',
      {},
      { kind: 'merged' },
      { kind: 'opened' },
      { kind: 'restored', from: 1.5 },
      { kind: 'accepted', changes: 'none' },
      {
        kind: 'accepted',
        changes: [{ origin: 'chat', instruction: 'x', rationale: 'y' }],
      },
    ]
    expect(causes.some(isCause)).toBe(false)
  })
})
