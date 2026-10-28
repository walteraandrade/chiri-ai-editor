import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { quickActionInstruction } from '../suggestions/instruction'
import {
  closeRefineEffect,
  openRefineEffect,
  refineInputField,
} from './refine-input'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  beginRefineEffect,
  failRefineEffect,
  rejectEffect,
  resolveEffect,
  suggestionsField,
} from './suggestion-field'

const DOC = 'First paragraph here.\n\nSecond paragraph here.'

const createHandle = (anchor = 5): EditorHandle => {
  let state = EditorState.create({
    doc: DOC,
    selection: { anchor },
    extensions: [suggestionsField, refineInputField],
  })
  return {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
  }
}

const openReady = (handle: EditorHandle): void => {
  handle.dispatch({
    effects: beginEffect.of({
      id: 'a',
      from: 0,
      to: 21,
      source: 'block',
      original: DOC.slice(0, 21),
      instruction: quickActionInstruction('shorter'),
    }),
  })
  handle.dispatch({
    effects: resolveEffect.of({
      id: 'a',
      result: {
        replacement: 'First.',
        rationale: 'Shorter.',
        unchanged: false,
      },
    }),
  })
}

const openFor = (handle: EditorHandle) => handle.state.field(refineInputField)

describe('refineInputField', () => {
  it('opens for a ready Suggestion and closes on request', () => {
    const handle = createHandle()
    openReady(handle)

    handle.dispatch({ effects: openRefineEffect.of('a') })
    expect(openFor(handle)).toBe('a')

    handle.dispatch({ effects: closeRefineEffect.of(null) })
    expect(openFor(handle)).toBeNull()
  })

  it('does not open for unknown or pending Suggestions', () => {
    const handle = createHandle()
    handle.dispatch({ effects: openRefineEffect.of('missing') })
    expect(openFor(handle)).toBeNull()

    handle.dispatch({
      effects: beginEffect.of({
        id: 'a',
        from: 0,
        to: 21,
        source: 'block',
        original: DOC.slice(0, 21),
        instruction: quickActionInstruction('shorter'),
      }),
    })
    handle.dispatch({ effects: openRefineEffect.of('a') })
    expect(openFor(handle)).toBeNull()
  })

  it('stays open while the cursor and the Document stay put', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    handle.dispatch({ effects: [] })

    expect(openFor(handle)).toBe('a')
  })

  it('closes when the cursor moves', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    handle.dispatch({ selection: { anchor: 7 } })

    expect(openFor(handle)).toBeNull()
  })

  it('closes when the Document changes', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    handle.dispatch({ changes: { from: 30, insert: 'x' } })

    expect(openFor(handle)).toBeNull()
  })

  it('closes when the Refine starts', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    handle.dispatch({
      effects: beginRefineEffect.of({
        id: 'a',
        instruction: { type: 'free-text', text: 'tighter' },
      }),
    })

    expect(openFor(handle)).toBeNull()
  })

  it('does not open while the Suggestion is refining, but does after a failure', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({
      effects: beginRefineEffect.of({
        id: 'a',
        instruction: { type: 'free-text', text: 'tighter' },
      }),
    })
    handle.dispatch({ effects: openRefineEffect.of('a') })
    expect(openFor(handle)).toBeNull()

    handle.dispatch({
      effects: failRefineEffect.of({
        id: 'a',
        error: { type: 'network', message: 'offline' },
      }),
    })
    handle.dispatch({ effects: openRefineEffect.of('a') })
    expect(openFor(handle)).toBe('a')
  })

  it('closes when the Suggestion goes away', () => {
    const handle = createHandle()
    openReady(handle)
    handle.dispatch({ effects: openRefineEffect.of('a') })

    handle.dispatch({ effects: rejectEffect.of('a') })

    expect(openFor(handle)).toBeNull()
  })
})
