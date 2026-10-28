import { type EditorState, Facet } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import type { ModelClient } from '../ai/client'
import { getNeighbors, targetFromRange } from '../blocks/target'
import { taskLabel } from '../suggestions/instruction'
import { findSuggestion, pendingSuggestionIds } from '../suggestions/state'
import type { Instruction, SuggestionId } from '../suggestions/types'
import { blocksOf, currentTarget } from './current-target'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  failEffect,
  resolveEffect,
  retryEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'

export type SuggestionActions = {
  readonly ask: (handle: EditorHandle, instruction: Instruction) => void
  readonly retry: (handle: EditorHandle, id: SuggestionId) => void
}

export const suggestionActionsFacet = Facet.define<
  SuggestionActions,
  SuggestionActions | undefined
>({ combine: (values) => values.at(-1) })

type RuntimeOptions = {
  readonly client: Pick<ModelClient, 'requestSuggestion'>
  readonly createId?: () => SuggestionId
}

export const createSuggestionRuntime = ({
  client,
  createId = (() => {
    let counter = 0
    return () => `s${++counter}`
  })(),
}: RuntimeOptions) => {
  const controllers = new Map<SuggestionId, AbortController>()

  const abortStale = (state: EditorState): void => {
    const pending = new Set(pendingSuggestionIds(suggestionsOf(state)))
    for (const [id, controller] of controllers) {
      if (pending.has(id)) continue
      controller.abort()
      controllers.delete(id)
    }
  }

  const run = async (
    handle: EditorHandle,
    id: SuggestionId,
    request: Parameters<typeof client.requestSuggestion>[0],
  ): Promise<void> => {
    const controller = new AbortController()
    controllers.set(id, controller)
    const result = await client.requestSuggestion({
      ...request,
      signal: controller.signal,
    })
    if (controllers.get(id) === controller) controllers.delete(id)
    if (controller.signal.aborted) return
    handle.dispatch({
      effects: result.ok
        ? resolveEffect.of({ id, result: result.value })
        : failEffect.of({ id, error: result.error }),
    })
  }

  const ask = (handle: EditorHandle, instruction: Instruction): void => {
    const { state } = handle
    const target = currentTarget(state)
    if (!target) return
    const id = createId()
    handle.dispatch({
      effects: beginEffect.of({
        id,
        from: target.from,
        to: target.to,
        source: target.source,
        original: target.text,
        instruction,
      }),
      ...(target.source === 'selection' && {
        selection: { anchor: target.to },
      }),
    })
    void run(handle, id, {
      target,
      neighbors: getNeighbors(blocksOf(state), target),
      instruction: instruction.text,
      task: taskLabel({
        source: target.source,
        blocks: target.blocks,
        instruction,
      }),
    })
  }

  const retry = (handle: EditorHandle, id: SuggestionId): void => {
    const { state } = handle
    const found = findSuggestion(suggestionsOf(state), id)
    if (found?.status !== 'error') return
    const blocks = blocksOf(state)
    const target = targetFromRange(
      blocks,
      state.doc.toString(),
      found,
      found.source,
    )
    handle.dispatch({ effects: retryEffect.of(id) })
    void run(handle, id, {
      target,
      neighbors: getNeighbors(blocks, target),
      instruction: found.instruction.text,
      task: taskLabel({
        source: found.source,
        blocks: target.blocks,
        instruction: found.instruction,
      }),
    })
  }

  const actions: SuggestionActions = { ask, retry }
  const reconcile = abortStale

  const extension = [
    suggestionActionsFacet.of(actions),
    ViewPlugin.define(() => ({
      update: (update) => {
        if (
          update.startState.field(suggestionsField) !==
          update.state.field(suggestionsField)
        ) {
          reconcile(update.state)
        }
      },
      destroy: () => {
        for (const controller of controllers.values()) controller.abort()
        controllers.clear()
      },
    })),
  ]

  return { actions, extension, reconcile }
}
