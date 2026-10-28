import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { RefineRequest, TargetRequest } from '../ai/client'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError, Result } from '../ai/errors'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { ReadySuggestion } from '../suggestions/types'
import { acceptSuggestionById, type EditorHandle } from './suggestion-commands'
import {
  cancelRefineEffect,
  rejectEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'
import { createSuggestionRuntime } from './suggestion-runtime'

const DOC = '# Title\n\nFirst paragraph here.\n\nSecond paragraph here.\n'
const FIRST = { from: 9, to: 30 }
const SECOND = { from: 32, to: 54 }

type Call<Request = TargetRequest> = {
  readonly request: Request
  readonly resolve: (result: Result<SuggestionResult>) => void
}

const createClient = () => {
  const calls: Call[] = []
  const refines: Call<RefineRequest>[] = []
  return {
    calls,
    refines,
    client: {
      requestSuggestion: (request: TargetRequest) =>
        new Promise<Result<SuggestionResult>>((resolve) => {
          calls.push({ request, resolve })
        }),
      refineSuggestion: (request: RefineRequest) =>
        new Promise<Result<SuggestionResult>>((resolve) => {
          refines.push({ request, resolve })
        }),
    },
  }
}

const createHandle = (from: number, to = from): EditorHandle => {
  let state = EditorState.create({
    doc: DOC,
    selection: { anchor: from, head: to },
    extensions: [suggestionsField],
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

const ok = (
  replacement: string,
  unchanged = false,
): Result<SuggestionResult> => ({
  ok: true,
  value: { replacement, rationale: 'Because.', unchanged },
})

const fail = (error: ClientError): Result<SuggestionResult> => ({
  ok: false,
  error,
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const only = <T>(items: readonly T[]): T => {
  const first = items[0]
  if (first === undefined) throw new Error('expected one item')
  return first
}

describe('ask', () => {
  it('starts a pending Suggestion on the selection and sends the Instruction', () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client })
    const handle = createHandle(FIRST.from + 6, FIRST.from + 15)

    runtime.actions.ask(handle, quickActionInstruction('shorter'))

    const [item] = suggestionsOf(handle.state).items
    expect(item).toMatchObject({
      status: 'pending',
      from: FIRST.from + 6,
      to: FIRST.from + 15,
      source: 'selection',
      original: 'paragraph',
    })
    const { request } = only(calls)
    expect(request.target.text).toBe('paragraph')
    expect(request.instruction).toBe(quickActionInstruction('shorter').text)
    expect(request.task).toBe('select p2 → Shorter')
    expect(request.neighbors.before.map((block) => block.id)).toEqual(['p1'])
    expect(request.signal?.aborted).toBe(false)
  })

  it('targets the Block under the cursor when nothing is selected', () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client })
    const handle = createHandle(SECOND.from + 3)

    runtime.actions.ask(handle, freeTextInstruction('more friendly'))

    expect(suggestionsOf(handle.state).items[0]).toMatchObject({
      source: 'block',
      from: SECOND.from,
      to: SECOND.to,
    })
    expect(only(calls).request.task).toBe(
      'cursor in p3 → free text: more friendly',
    )
  })

  it('does nothing without a Target', () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client })
    const handle = createHandle(0)
    handle.dispatch({ changes: { from: 0, to: DOC.length } })

    runtime.actions.ask(handle, quickActionInstruction('shorter'))

    expect(calls).toEqual([])
    expect(suggestionsOf(handle.state).items).toEqual([])
  })

  it('turns the pending Suggestion into a ready one when the model answers', async () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))

    only(calls).resolve(ok('First one.'))
    await settle()

    expect(findSuggestion(suggestionsOf(handle.state), 'a')).toMatchObject({
      status: 'ready',
      replacement: 'First one.',
    })
  })

  it('shows the "no change" notice and no Suggestion for an unchanged Replacement', async () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('fix-grammar'))

    only(calls).resolve(ok('First paragraph here.', true))
    await settle()

    expect(suggestionsOf(handle.state).items).toEqual([])
    expect(suggestionsOf(handle.state).notice?.kind).toBe('no-change')
  })
})

describe('errors and retry', () => {
  it('keeps the request on failure and re-runs it on retry', async () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, freeTextInstruction('punchier'))

    only(calls).resolve(fail({ type: 'out-of-credit', message: 'No credit' }))
    await settle()
    expect(findSuggestion(suggestionsOf(handle.state), 'a')).toMatchObject({
      status: 'error',
      error: { type: 'out-of-credit' },
    })

    runtime.actions.retry(handle, 'a')
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'pending',
    )
    expect(calls).toHaveLength(2)
    const retried = calls[1]
    expect(retried?.request.instruction).toBe('punchier')
    expect(retried?.request.target.text).toBe('First paragraph here.')
    expect(retried?.request.task).toBe('cursor in p2 → free text: punchier')

    retried?.resolve(ok('Punchy first.'))
    await settle()
    expect(findSuggestion(suggestionsOf(handle.state), 'a')?.status).toBe(
      'ready',
    )
  })

  it('retries against the mapped range after an edit before the Suggestion', async () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(SECOND.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('clearer'))
    only(calls).resolve(fail({ type: 'network', message: 'offline' }))
    await settle()

    handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })
    runtime.actions.retry(handle, 'a')

    expect(calls[1]?.request.target.text).toBe('Second paragraph here.')
  })

  it('ignores retry for Suggestions that are not in error', () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))

    runtime.actions.retry(handle, 'a')

    expect(calls).toHaveLength(1)
  })
})

describe('abort on Discard', () => {
  it('aborts the request when its Target is edited and ignores the late answer', async () => {
    const { client, calls } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))
    const call = only(calls)

    handle.dispatch({ changes: { from: FIRST.from + 5, insert: 'x' } })
    runtime.reconcile(handle.state)
    expect(call.request.signal?.aborted).toBe(true)

    call.resolve(ok('Late answer.'))
    await settle()
    expect(suggestionsOf(handle.state).items).toEqual([])
    expect(suggestionsOf(handle.state).notice?.kind).toBe('text-changed')
  })

  it('aborts the older request when a newer one overlaps it', () => {
    const { client, calls } = createClient()
    let counter = 0
    const runtime = createSuggestionRuntime({
      client,
      createId: () => `s${++counter}`,
    })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))
    runtime.actions.ask(handle, quickActionInstruction('clearer'))
    runtime.reconcile(handle.state)

    expect(calls[0]?.request.signal?.aborted).toBe(true)
    expect(calls[1]?.request.signal?.aborted).toBe(false)
    expect(suggestionsOf(handle.state).items.map((item) => item.id)).toEqual([
      's2',
    ])
    expect(suggestionsOf(handle.state).notice?.kind).toBe('replaced')
  })

  it('keeps Suggestions on other Blocks running', () => {
    const { client, calls } = createClient()
    let counter = 0
    const runtime = createSuggestionRuntime({
      client,
      createId: () => `s${++counter}`,
    })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))
    handle.dispatch({ selection: { anchor: SECOND.from + 3 } })
    runtime.actions.ask(handle, quickActionInstruction('clearer'))
    runtime.reconcile(handle.state)

    expect(calls.map((call) => call.request.signal?.aborted)).toEqual([
      false,
      false,
    ])
    expect(suggestionsOf(handle.state).items).toHaveLength(2)
  })
})

describe('refine', () => {
  const FORMAL = freeTextInstruction('now more formal')
  const SHORTER_FREE = freeTextInstruction('make it shorter')

  const openReady = async (cursor = FIRST.from + 3) => {
    const context = createClient()
    const runtime = createSuggestionRuntime({
      client: context.client,
      createId: () => 'a',
    })
    const handle = createHandle(cursor)
    runtime.actions.ask(handle, quickActionInstruction('clearer'))
    only(context.calls).resolve(ok('First paragraph, clearer.'))
    await settle()
    return { ...context, runtime, handle }
  }

  const readyOf = (handle: EditorHandle): ReadySuggestion => {
    const found = findSuggestion(suggestionsOf(handle.state), 'a')
    if (found?.status !== 'ready') throw new Error('not ready')
    return found
  }

  it('keeps the Replacement visible and sends the full context', async () => {
    const { runtime, handle, refines } = await openReady()

    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    expect(readyOf(handle)).toMatchObject({
      status: 'ready',
      replacement: 'First paragraph, clearer.',
      refine: { status: 'working', instruction: SHORTER_FREE },
    })
    const { request } = only(refines)
    expect(request.target.text).toBe('First paragraph here.')
    expect(request.history).toEqual([quickActionInstruction('clearer').text])
    expect(request.latestReplacement).toBe('First paragraph, clearer.')
    expect(request.instruction).toBe('make it shorter')
    expect(request.task).toBe('refine p2 → make it shorter')
    expect(request.neighbors.before.map((block) => block.id)).toEqual(['p1'])
    expect(request.neighbors.after.map((block) => block.id)).toEqual(['p3'])
    expect(request.signal?.aborted).toBe(false)
  })

  it('replaces the Replacement and Rationale in place', async () => {
    const { runtime, handle, refines } = await openReady()
    const before = readyOf(handle)
    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    only(refines).resolve({
      ok: true,
      value: {
        replacement: 'First, clearer.',
        rationale: 'Shorter.',
        unchanged: false,
      },
    })
    await settle()

    expect(readyOf(handle)).toMatchObject({
      id: 'a',
      from: before.from,
      to: before.to,
      original: 'First paragraph here.',
      replacement: 'First, clearer.',
      rationale: 'Shorter.',
      refine: { status: 'idle' },
    })
    expect(readyOf(handle).history).toHaveLength(2)
  })

  it('sends every earlier Instruction and the latest Replacement on a second Refine', async () => {
    const { runtime, handle, refines } = await openReady()
    runtime.actions.refine(handle, 'a', SHORTER_FREE)
    only(refines).resolve(ok('First, clearer.'))
    await settle()

    runtime.actions.refine(handle, 'a', FORMAL)

    const second = refines[1]?.request
    expect(second?.history).toEqual([
      quickActionInstruction('clearer').text,
      'make it shorter',
    ])
    expect(second?.latestReplacement).toBe('First, clearer.')
    expect(second?.target.text).toBe('First paragraph here.')
    expect(second?.task).toBe('refine p2 → now more formal')
  })

  it('shows "no change" and keeps the Replacement when the model repeats it', async () => {
    const { runtime, handle, refines } = await openReady()
    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    only(refines).resolve(ok('First paragraph, clearer.'))
    await settle()

    expect(readyOf(handle)).toMatchObject({
      replacement: 'First paragraph, clearer.',
      refine: { status: 'idle' },
    })
    expect(readyOf(handle).history).toHaveLength(1)
    expect(suggestionsOf(handle.state).notice?.kind).toBe('no-change')
  })

  it('keeps the Replacement on failure and retries the same Refine', async () => {
    const { runtime, handle, refines } = await openReady()
    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    only(refines).resolve(fail({ type: 'out-of-credit', message: 'No credit' }))
    await settle()

    expect(readyOf(handle)).toMatchObject({
      status: 'ready',
      replacement: 'First paragraph, clearer.',
      rationale: 'Because.',
      refine: { status: 'failed', error: { type: 'out-of-credit' } },
    })

    runtime.actions.retryRefine(handle, 'a')
    expect(readyOf(handle).refine.status).toBe('working')
    expect(refines).toHaveLength(2)
    const retried = refines[1]
    expect(retried?.request.instruction).toBe('make it shorter')
    expect(retried?.request.latestReplacement).toBe('First paragraph, clearer.')
    expect(retried?.request.history).toEqual([
      quickActionInstruction('clearer').text,
    ])
    expect(retried?.request.task).toBe('refine p2 → make it shorter')

    retried?.resolve(ok('First, clearer.'))
    await settle()
    expect(readyOf(handle)).toMatchObject({
      replacement: 'First, clearer.',
      refine: { status: 'idle' },
    })
    expect(readyOf(handle).history).toHaveLength(2)
  })

  it('lets a failed Refine start over with a new Instruction', async () => {
    const { runtime, handle, refines } = await openReady()
    runtime.actions.refine(handle, 'a', SHORTER_FREE)
    only(refines).resolve(fail({ type: 'network', message: 'offline' }))
    await settle()

    runtime.actions.refine(handle, 'a', FORMAL)

    expect(refines[1]?.request.instruction).toBe('now more formal')
    expect(readyOf(handle).refine).toEqual({
      status: 'working',
      instruction: FORMAL,
    })
  })

  it('does not start a second Refine while one is running', async () => {
    const { runtime, handle, refines } = await openReady()
    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    runtime.actions.refine(handle, 'a', FORMAL)

    expect(refines).toHaveLength(1)
    expect(readyOf(handle).refine).toEqual({
      status: 'working',
      instruction: SHORTER_FREE,
    })
  })

  it('ignores Refine and its retry for Suggestions that cannot take them', async () => {
    const { client, calls, refines } = createClient()
    const runtime = createSuggestionRuntime({ client, createId: () => 'a' })
    const handle = createHandle(FIRST.from + 3)
    runtime.actions.ask(handle, quickActionInstruction('shorter'))

    runtime.actions.refine(handle, 'a', FORMAL)
    runtime.actions.retryRefine(handle, 'a')
    runtime.actions.refine(handle, 'missing', FORMAL)

    expect(refines).toEqual([])
    expect(calls).toHaveLength(1)

    only(calls).resolve(ok('First one.'))
    await settle()
    runtime.actions.retryRefine(handle, 'a')
    expect(refines).toEqual([])
  })

  it('uses the mapped range after an edit before the Suggestion', async () => {
    const { runtime, handle, refines } = await openReady(SECOND.from + 3)
    handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })

    runtime.actions.refine(handle, 'a', SHORTER_FREE)

    expect(only(refines).request.target.text).toBe('Second paragraph here.')
  })

  describe('while refining', () => {
    it('aborts the Refine on Reject and ignores the late answer', async () => {
      const { runtime, handle, refines } = await openReady()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      handle.dispatch({ effects: rejectEffect.of('a') })
      runtime.reconcile(handle.state)
      expect(call.request.signal?.aborted).toBe(true)

      call.resolve(ok('Late answer.'))
      await settle()
      expect(suggestionsOf(handle.state).items).toEqual([])
      expect(suggestionsOf(handle.state).notice).toBeNull()
    })

    it('aborts the Refine when it is cancelled and keeps the Suggestion', async () => {
      const { runtime, handle, refines } = await openReady()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      handle.dispatch({ effects: cancelRefineEffect.of('a') })
      runtime.reconcile(handle.state)
      expect(call.request.signal?.aborted).toBe(true)

      call.resolve(ok('Late answer.'))
      await settle()
      expect(readyOf(handle)).toMatchObject({
        replacement: 'First paragraph, clearer.',
        refine: { status: 'idle' },
      })
      expect(readyOf(handle).history).toHaveLength(1)
      expect(suggestionsOf(handle.state).notice).toBeNull()
    })

    it('aborts the Refine on Accept', async () => {
      const { runtime, handle, refines } = await openReady()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      acceptSuggestionById(handle, 'a')
      runtime.reconcile(handle.state)

      expect(call.request.signal?.aborted).toBe(true)
      expect(handle.state.doc.toString()).toContain('First paragraph, clearer.')
      call.resolve(ok('Late answer.'))
      await settle()
      expect(handle.state.doc.toString()).not.toContain('Late answer.')
    })

    it('aborts the Refine and Discards the Suggestion on an edit inside', async () => {
      const { runtime, handle, refines } = await openReady()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      handle.dispatch({ changes: { from: FIRST.from + 5, insert: 'x' } })
      runtime.reconcile(handle.state)

      expect(call.request.signal?.aborted).toBe(true)
      expect(suggestionsOf(handle.state).items).toEqual([])
      expect(suggestionsOf(handle.state).notice?.kind).toBe('text-changed')
    })

    it('keeps refining through an edit outside the Suggestion', async () => {
      const { runtime, handle, refines } = await openReady()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      handle.dispatch({ changes: { from: 0, insert: 'Intro.\n\n' } })
      runtime.reconcile(handle.state)
      expect(call.request.signal?.aborted).toBe(false)

      call.resolve(ok('First, clearer.'))
      await settle()
      expect(readyOf(handle)).toMatchObject({
        replacement: 'First, clearer.',
        from: FIRST.from + 8,
      })
    })

    it('aborts the Refine when a newer request overlaps the Suggestion', async () => {
      const { client, calls, refines } = createClient()
      const ids = ['a', 'b']
      const runtime = createSuggestionRuntime({
        client,
        createId: () => ids.shift() ?? 'z',
      })
      const handle = createHandle(FIRST.from + 3)
      runtime.actions.ask(handle, quickActionInstruction('clearer'))
      only(calls).resolve(ok('First paragraph, clearer.'))
      await settle()
      runtime.actions.refine(handle, 'a', SHORTER_FREE)
      const call = only(refines)

      runtime.actions.ask(handle, quickActionInstruction('shorter'))
      runtime.reconcile(handle.state)

      expect(call.request.signal?.aborted).toBe(true)
      expect(suggestionsOf(handle.state).items.map((item) => item.id)).toEqual([
        'b',
      ])
    })
  })
})
