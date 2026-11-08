import { describe, expect, it } from 'vitest'
import { endedText, failureReason } from './ended'
import type { EvalRunResult } from './types'

describe('failureReason', () => {
  it('explains each run result that is not a summary', () => {
    expect(failureReason({ kind: 'busy' })).toBe(
      'Another Eval run is in progress',
    )
    expect(failureReason({ kind: 'no-cli' })).toBe(
      'The Claude CLI was not found',
    )
    expect(failureReason({ kind: 'risks-changed' })).toBe(
      'The Skill changed while you were confirming. Run again.',
    )
    expect(
      failureReason({ kind: 'failed', reason: 'Could not run claude' }),
    ).toBe('Could not run claude')
  })
})

describe('endedText', () => {
  it('says a run finished', () => {
    const completed = { kind: 'completed', summary: {} } as EvalRunResult
    expect(endedText('pdf', completed)).toBe('Evals for pdf finished')
  })

  it('says why a run stopped, with its cost', () => {
    expect(
      endedText('pdf', {
        kind: 'not-complete',
        message: 'Cancelled',
        costUsd: 0.0061,
      }),
    ).toBe("pdf: Cancelled. Cost about US$0.0061, the CLI's figure.")
  })

  it('says why a run failed', () => {
    expect(endedText('pdf', { kind: 'no-cli' })).toBe(
      'pdf: The Claude CLI was not found',
    )
  })
})
