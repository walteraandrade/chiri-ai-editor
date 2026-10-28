import { history, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { ReviewEvent, ReviewRequest } from '../ai/client'
import type { ValidatedEdit } from '../ai/edits'
import type { ClientError } from '../ai/errors'
import { type Block, extractBlocks } from '../blocks/extract-blocks'
import { quickActionInstruction } from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import { reviewRunOf, reviewStatusOf } from './review-field'
import {
  createReviewRuntime,
  type ReviewDrop,
  type ReviewNotice,
} from './review-runtime'
import {
  acceptAllReviewSuggestions,
  type EditorHandle,
  rejectAllReviewSuggestions,
} from './suggestion-commands'
import {
  beginEffect,
  resolveEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'

const DOC = [
  '# Title',
  '',
  'First paragraph here.',
  '',
  'Second paragraph here.',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  'Third paragraph here.',
  '',
].join('\n')

const blocks = extractBlocks(DOC)
const block = (text: string): Block => {
  const found = blocks.find((candidate) => candidate.text === text)
  if (!found) throw new Error(`no block ${text}`)
  return found
}
const FIRST = block('First paragraph here.')
const SECOND = block('Second paragraph here.')
const THIRD = block('Third paragraph here.')

const edit = (target: Block, replacement: string): ValidatedEdit => ({
  blockId: target.id,
  replacement,
  rationale: `Because ${target.id}.`,
  block: target,
})

const editEvent = (target: Block, replacement: string): ReviewEvent => ({
  type: 'edit',
  edit: edit(target, replacement),
  elapsedMs: 10,
})

const doneEvent = (overrides: Partial<ReviewEvent> = {}): ReviewEvent =>
  ({
    type: 'done',
    validated: 0,
    dropped: 0,
    attempts: 1,
    incomplete: false,
    firstSuggestionMs: null,
    ...overrides,
  }) as ReviewEvent

type Stream = {
  readonly request: ReviewRequest
  readonly push: (event: ReviewEvent) => Promise<void>
  readonly finish: () => Promise<void>
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const createFakeClient = () => {
  const streams: Stream[] = []
  return {
    streams,
    client: {
      reviewDocument: (request: ReviewRequest) => {
        const queue: ReviewEvent[] = []
        let wake: (() => void) | undefined
        let closed = false
        streams.push({
          request,
          push: async (event) => {
            queue.push(event)
            wake?.()
            await settle()
          },
          finish: async () => {
            closed = true
            wake?.()
            await settle()
          },
        })
        return (async function* (): AsyncGenerator<ReviewEvent, void> {
          for (;;) {
            const next = queue.shift()
            if (next !== undefined) {
              yield next
              continue
            }
            if (closed) return
            await new Promise<void>((resolve) => {
              wake = resolve
            })
          }
        })()
      },
    },
  }
}

const setup = (doc = DOC) => {
  const fake = createFakeClient()
  const notices: ReviewNotice[] = []
  const drops: ReviewDrop[] = []
  let counter = 0
  const runtime = createReviewRuntime({
    client: fake.client,
    onNotice: (notice) => notices.push(notice),
    onDrop: (drop) => drops.push(drop),
    createId: () => `r${++counter}`,
  })
  let state = EditorState.create({
    doc,
    extensions: [suggestionsField, history(), runtime.extension],
  })
  const handle: EditorHandle = {
    get state() {
      return state
    },
    dispatch: (spec: TransactionSpec) => {
      state = state.update(spec).state
    },
  }
  return { ...fake, runtime, handle, notices, drops }
}

const only = <T>(items: readonly T[]): T => {
  const first = items[0]
  if (first === undefined) throw new Error('expected one item')
  return first
}

const idsOf = (handle: EditorHandle): readonly string[] =>
  suggestionsOf(handle.state).items.map((item) => item.id)

describe('start', () => {
  it('sends the whole Document with the Focus and marks the run as started', () => {
    const { runtime, handle, streams } = setup()

    runtime.actions.start(handle, '  tone only ')

    const { request } = only(streams)
    expect(request.blocks.map((entry) => entry.id)).toEqual(
      blocks.map((entry) => entry.id),
    )
    expect(request.blocks.map((entry) => entry.text)).toEqual(
      blocks.map((entry) => entry.text),
    )
    expect(request.focus).toBe('tone only')
    expect(request.task).toBe('review document → focus: tone only')
    expect(request.signal?.aborted).toBe(false)
    expect(reviewRunOf(handle.state)).toMatchObject({
      focus: 'tone only',
      added: 0,
      dropped: 0,
    })
    expect(reviewStatusOf(handle.state)).toEqual({
      running: true,
      added: 0,
      open: 0,
    })
  })

  it('reviews with the default criteria when the Focus is empty', () => {
    const { runtime, handle, streams } = setup()

    runtime.actions.start(handle, '')

    expect(only(streams).request.task).toBe(
      'review document → default criteria',
    )
  })

  it('passes the Blocks that already have a Suggestion as occupied', () => {
    const { runtime, handle, streams } = setup()
    handle.dispatch({
      effects: beginEffect.of({
        id: 'a',
        from: SECOND.from + 2,
        to: SECOND.from + 8,
        source: 'selection',
        original: 'cond p',
        instruction: quickActionInstruction('shorter'),
      }),
    })

    runtime.actions.start(handle, '')

    expect(only(streams).request.occupied).toEqual(new Set([SECOND.id]))
  })

  it('does not start a second Review pass while one streams', () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, 'tone')

    runtime.actions.start(handle, 'grammar')

    expect(streams).toHaveLength(1)
    expect(reviewRunOf(handle.state)?.focus).toBe('tone')
  })

  it('makes no model call when every Block is code or occupied', () => {
    const { runtime, handle, streams, notices } = setup(
      '```js\nconst a = 1\n```',
    )

    runtime.actions.start(handle, '')

    expect(streams).toEqual([])
    expect(reviewRunOf(handle.state)).toBeNull()
    expect(notices).toEqual([{ text: 'Review: no suggestions' }])
  })
})

describe('streaming', () => {
  it('turns each edit into a ready review Suggestion as soon as it arrives', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, 'tone')
    const stream = only(streams)

    await stream.push(editEvent(SECOND, 'Second one.'))

    expect(reviewRunOf(handle.state)).not.toBeNull()
    expect(findSuggestion(suggestionsOf(handle.state), 'r1')).toMatchObject({
      status: 'ready',
      origin: 'review',
      source: 'block',
      from: SECOND.from,
      to: SECOND.to,
      original: SECOND.text,
      replacement: 'Second one.',
      rationale: `Because ${SECOND.id}.`,
      instruction: { type: 'free-text', text: 'tone' },
    })
    expect(reviewStatusOf(handle.state)).toEqual({
      running: true,
      added: 1,
      open: 1,
    })

    await stream.push(editEvent(FIRST, 'First one.'))
    expect(idsOf(handle)).toEqual(['r1', 'r2'])
    expect(reviewStatusOf(handle.state).added).toBe(2)
  })

  it('does not change the Document', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')

    await only(streams).push(editEvent(SECOND, 'Second one.'))

    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('ends with a summary notice and clears the run', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    await stream.push(editEvent(SECOND, 'Second one.'))
    await stream.push(editEvent(FIRST, 'First one.'))
    expect(notices).toEqual([])

    await stream.push(doneEvent({ validated: 2 }))

    expect(notices).toEqual([{ text: 'Review: 2 suggestions' }])
    expect(reviewRunOf(handle.state)).toBeNull()
    expect(reviewStatusOf(handle.state)).toEqual({
      running: false,
      added: 0,
      open: 2,
    })
  })

  it('says "no suggestions" when nothing came back', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')

    await only(streams).push(doneEvent())

    expect(notices).toEqual([{ text: 'Review: no suggestions' }])
  })

  it('stays quiet about edits the client dropped, and reports the reasons', async () => {
    const { runtime, handle, streams, notices, drops } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)

    await stream.push({
      type: 'dropped',
      edit: { blockId: 'p99', replacement: 'x', rationale: 'y' },
      reason: 'unknown-block',
    })
    await stream.push({
      type: 'dropped',
      edit: { blockId: THIRD.id, replacement: 'x', rationale: 'y' },
      reason: 'junk',
    })
    await stream.push(editEvent(SECOND, 'Second one.'))
    await stream.push(doneEvent({ validated: 1, dropped: 2 }))

    expect(notices).toEqual([{ text: 'Review: 1 suggestion' }])
    expect(drops).toEqual([
      { blockId: 'p99', reason: 'unknown-block' },
      { blockId: THIRD.id, reason: 'junk' },
    ])
    expect(idsOf(handle)).toEqual(['r1'])
  })

  it('never keeps more than 6 Suggestions from one pass', async () => {
    const many = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}.`)
    const doc = many.join('\n\n')
    const { runtime, handle, streams } = setup(doc)
    runtime.actions.start(handle, '')
    const stream = only(streams)

    for (const target of extractBlocks(doc)) {
      await stream.push(editEvent(target, `${target.text} Edited.`))
    }

    expect(idsOf(handle)).toHaveLength(6)
  })

  it('can start a new pass after the previous one ended, skipping its Blocks', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    await only(streams).push(editEvent(SECOND, 'Second one.'))
    await only(streams).push(doneEvent({ validated: 1 }))

    runtime.actions.start(handle, 'grammar')

    expect(streams).toHaveLength(2)
    expect(streams[1]?.request.occupied).toEqual(new Set([SECOND.id]))
  })
})

describe('edits made while the pass streams', () => {
  it('places an edit at the shifted range after typing elsewhere', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })

    await only(streams).push(editEvent(SECOND, 'Second one.'))

    const found = findSuggestion(suggestionsOf(handle.state), 'r1')
    expect(found).toMatchObject({
      status: 'ready',
      from: SECOND.from + 8,
      to: SECOND.to + 8,
    })
    expect(handle.state.doc.sliceString(found?.from ?? 0, found?.to ?? 0)).toBe(
      SECOND.text,
    )
  })

  it('maps through every change since the pass started', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })
    await stream.push(editEvent(FIRST, 'First one.'))
    handle.dispatch({ changes: { from: 0, insert: 'More.\n\n' } })

    await stream.push(editEvent(THIRD, 'Third one.'))

    const found = findSuggestion(suggestionsOf(handle.state), 'r2')
    expect(handle.state.doc.sliceString(found?.from ?? 0, found?.to ?? 0)).toBe(
      THIRD.text,
    )
    expect(found?.from).toBe(THIRD.from + 8 + 7)
  })

  it('drops an edit when the user typed inside its Block, and counts it', async () => {
    const { runtime, handle, streams, drops } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    handle.dispatch({
      changes: { from: SECOND.from + 4, insert: 'zz' },
    })

    await stream.push(editEvent(SECOND, 'Second one.'))

    expect(idsOf(handle)).toEqual([])
    expect(reviewRunOf(handle.state)).toMatchObject({ added: 0, dropped: 1 })
    expect(drops).toEqual([{ blockId: SECOND.id, reason: 'text-changed' }])
  })

  it('still places the edits for Blocks the user did not touch', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    handle.dispatch({ changes: { from: SECOND.from + 4, insert: 'zz' } })

    await stream.push(editEvent(SECOND, 'Second one.'))
    await stream.push(editEvent(THIRD, 'Third one.'))

    expect(idsOf(handle)).toEqual(['r2'])
    const found = findSuggestion(suggestionsOf(handle.state), 'r2')
    expect(handle.state.doc.sliceString(found?.from ?? 0, found?.to ?? 0)).toBe(
      THIRD.text,
    )
  })

  it('drops an edit when a new Suggestion now overlaps its Block', async () => {
    const { runtime, handle, streams, drops } = setup()
    runtime.actions.start(handle, '')
    handle.dispatch({
      effects: beginEffect.of({
        id: 'ask',
        from: SECOND.from,
        to: SECOND.to,
        source: 'block',
        original: SECOND.text,
        instruction: quickActionInstruction('shorter'),
      }),
    })

    await only(streams).push(editEvent(SECOND, 'Second one.'))

    expect(idsOf(handle)).toEqual(['ask'])
    expect(reviewRunOf(handle.state)).toMatchObject({ added: 0, dropped: 1 })
    expect(drops).toEqual([{ blockId: SECOND.id, reason: 'occupied' }])
  })

  it('does not replace a ready Suggestion the user got in the meantime', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    handle.dispatch({
      effects: [
        beginEffect.of({
          id: 'ask',
          from: SECOND.from,
          to: SECOND.to,
          source: 'block',
          original: SECOND.text,
          instruction: quickActionInstruction('shorter'),
        }),
        resolveEffect.of({
          id: 'ask',
          result: { replacement: 'Mine.', rationale: 'x', unchanged: false },
        }),
      ],
    })

    await only(streams).push(editEvent(SECOND, 'Second one.'))

    expect(findSuggestion(suggestionsOf(handle.state), 'ask')).toMatchObject({
      replacement: 'Mine.',
      origin: 'ask',
    })
    expect(suggestionsOf(handle.state).notice).toBeNull()
  })
})

describe('Stop', () => {
  it('aborts the stream, keeps the Suggestions shown and says so', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    await stream.push(editEvent(SECOND, 'Second one.'))

    runtime.actions.stop(handle)

    expect(stream.request.signal?.aborted).toBe(true)
    expect(reviewRunOf(handle.state)).toBeNull()
    expect(idsOf(handle)).toEqual(['r1'])
    expect(notices).toEqual([{ text: 'Review stopped: 1 suggestion' }])
  })

  it('ignores edits and the final event that arrive after Stop', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    runtime.actions.stop(handle)

    await stream.push(editEvent(SECOND, 'Late.'))
    await stream.push({
      type: 'error',
      error: { type: 'aborted', message: 'Stopped' },
    })

    expect(idsOf(handle)).toEqual([])
    expect(notices).toEqual([{ text: 'Review stopped: no suggestions' }])
  })

  it('allows a new pass after Stop', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    runtime.actions.stop(handle)

    runtime.actions.start(handle, 'again')

    expect(streams).toHaveLength(2)
    expect(streams[1]?.request.signal?.aborted).toBe(false)
  })

  it('does nothing when no pass is running', () => {
    const { runtime, handle, notices } = setup()
    runtime.actions.stop(handle)
    expect(notices).toEqual([])
  })
})

describe('errors', () => {
  const failWith = (error: ClientError): ReviewEvent => ({
    type: 'error',
    error,
  })

  it('before any Suggestion, shows the message with Retry that runs the same Focus again', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, 'tone')
    await only(streams).push(
      failWith({ type: 'out-of-credit', message: 'No credit' }),
    )

    const notice = only(notices)
    expect(notice.text).toMatch(/out of credit/i)
    expect(reviewRunOf(handle.state)).toBeNull()
    expect(notice.retry).toBeTypeOf('function')

    notice.retry?.()
    expect(streams).toHaveLength(2)
    expect(streams[1]?.request.focus).toBe('tone')
  })

  it('ignores Retry once the editor is destroyed', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, 'tone')
    await only(streams).push(failWith({ type: 'timeout', message: 'slow' }))
    const retry = only(notices).retry

    runtime.destroy()
    retry?.()

    expect(streams).toHaveLength(1)
  })

  it('aborts a running pass on destroy and starts nothing afterwards', () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    const { request } = only(streams)

    runtime.destroy()
    runtime.actions.start(handle, 'again')

    expect(request.signal?.aborted).toBe(true)
    expect(streams).toHaveLength(1)
  })

  it('shows a different message per error type', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')
    await only(streams).push(
      failWith({ type: 'rate-limited', message: 'Slow down' }),
    )
    expect(only(notices).text).toMatch(/too many requests/i)
  })

  it('after some Suggestions, keeps them and shows the message', async () => {
    const { runtime, handle, streams, notices } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    await stream.push(editEvent(SECOND, 'Second one.'))

    await stream.push(
      doneEvent({
        validated: 1,
        incomplete: true,
        error: { type: 'timeout', message: 'slow' },
      }),
    )

    expect(idsOf(handle)).toEqual(['r1'])
    expect(only(notices).text).toContain('Review: 1 suggestion')
    expect(only(notices).text).toMatch(/took too long/i)
    expect(reviewRunOf(handle.state)).toBeNull()
  })

  it('treats a thrown stream as an unknown error', async () => {
    const notices: ReviewNotice[] = []
    const runtime = createReviewRuntime({
      client: {
        reviewDocument: () =>
          (async function* (): AsyncGenerator<ReviewEvent, void> {
            yield* []
            throw new Error('boom')
          })(),
      },
      onNotice: (notice) => notices.push(notice),
    })
    let state = EditorState.create({
      doc: DOC,
      extensions: [suggestionsField, runtime.extension],
    })
    runtime.actions.start(
      {
        get state() {
          return state
        },
        dispatch: (spec) => {
          state = state.update(spec).state
        },
      },
      '',
    )
    await settle()

    expect(only(notices).text).toMatch(/something went wrong/i)
    expect(reviewRunOf(state)).toBeNull()
  })
})

describe('Accept all and Reject all after a pass', () => {
  const afterPass = async () => {
    const context = setup()
    context.runtime.actions.start(context.handle, '')
    const stream = only(context.streams)
    await stream.push(editEvent(SECOND, 'Second one.'))
    await stream.push(editEvent(THIRD, 'Third one.'))
    await stream.push(doneEvent({ validated: 2 }))
    return context
  }

  it('applies every review Suggestion in one undoable transaction', async () => {
    const { handle } = await afterPass()

    expect(acceptAllReviewSuggestions(handle)).toBe(true)
    expect(handle.state.doc.toString()).toBe(
      DOC.replace('Second paragraph here.', 'Second one.').replace(
        'Third paragraph here.',
        'Third one.',
      ),
    )
    expect(idsOf(handle)).toEqual([])

    undo({
      state: handle.state,
      dispatch: (transaction) => handle.dispatch(transaction),
    })
    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('drops them all with Reject all', async () => {
    const { handle } = await afterPass()

    expect(rejectAllReviewSuggestions(handle)).toBe(true)

    expect(idsOf(handle)).toEqual([])
    expect(handle.state.doc.toString()).toBe(DOC)
  })

  it('keeps accepting while the pass still streams, and later edits still land', async () => {
    const { runtime, handle, streams } = setup()
    runtime.actions.start(handle, '')
    const stream = only(streams)
    await stream.push(editEvent(SECOND, 'Second one.'))

    acceptAllReviewSuggestions(handle)
    await stream.push(editEvent(THIRD, 'Third one.'))

    const found = findSuggestion(suggestionsOf(handle.state), 'r2')
    expect(found?.status).toBe('ready')
    expect(handle.state.doc.sliceString(found?.from ?? 0, found?.to ?? 0)).toBe(
      THIRD.text,
    )
  })
})
