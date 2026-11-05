import { describe, expect, it, vi } from 'vitest'
import { applyHistoryEvent } from './events'

const createRecorder = () => ({
  edited: vi.fn(),
  accepted: vi.fn(),
  replaced: vi.fn(),
})

describe('applyHistoryEvent', () => {
  it('passes edits on as pending text', () => {
    const recorder = createRecorder()
    applyHistoryEvent(recorder, { type: 'edited', text: 'abc' })
    expect(recorder.edited).toHaveBeenCalledWith('abc')
    expect(recorder.accepted).not.toHaveBeenCalled()
  })

  it('passes an Accept on with its Suggestions', () => {
    const recorder = createRecorder()
    const event = {
      type: 'accepted',
      before: 'a',
      text: 'b',
      changes: [{ origin: 'ask', instruction: 'Clearer', rationale: 'Why.' }],
    } as const
    applyHistoryEvent(recorder, event)
    expect(recorder.accepted).toHaveBeenCalledWith(event)
  })

  it('passes a replace on with the text before it', () => {
    const recorder = createRecorder()
    applyHistoryEvent(recorder, { type: 'replaced', before: 'old' })
    expect(recorder.replaced).toHaveBeenCalledWith('old')
  })
})
