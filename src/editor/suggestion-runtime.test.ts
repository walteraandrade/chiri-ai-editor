import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import type { TargetRequest } from '../ai/client'
import type { SuggestionResult } from '../ai/edits'
import type { ClientError, Result } from '../ai/errors'
import {
  freeTextInstruction,
  quickActionInstruction,
} from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { EditorHandle } from './suggestion-commands'
import { suggestionsField, suggestionsOf } from './suggestion-field'
import { createSuggestionRuntime } from './suggestion-runtime'

const DOC = '# Title\n\nFirst paragraph here.\n\nSecond paragraph here.\n'
const FIRST = { from: 9, to: 30 }
const SECOND = { from: 32, to: 54 }

type Call = {
  readonly request: TargetRequest
  readonly resolve: (result: Result<SuggestionResult>) => void
}

const createClient = () => {
  const calls: Call[] = []
  return {
    calls,
    client: {
      requestSuggestion: (request: TargetRequest) =>
        new Promise<Result<SuggestionResult>>((resolve) => {
          calls.push({ request, resolve })
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
