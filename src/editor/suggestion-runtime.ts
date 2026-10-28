import { type EditorState, Facet, type StateEffect } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import type { ModelClient } from '../ai/client'
import type { SuggestionResult } from '../ai/edits'
import type { Result } from '../ai/errors'
import { getNeighbors, targetFromRange } from '../blocks/target'
import { refineTaskLabel, taskLabel } from '../suggestions/instruction'
import {
  findSuggestion,
  inFlightSuggestionIds,
  instructionHistory,
} from '../suggestions/state'
import type {
  Instruction,
  ReadySuggestion,
  SuggestionId,
} from '../suggestions/types'
import { blocksOf, currentTarget, textOf } from './current-target'
import type { EditorHandle } from './suggestion-commands'
import {
  beginEffect,
  beginRefineEffect,
  failEffect,
  failRefineEffect,
  resolveEffect,
  resolveRefineEffect,
  retryEffect,
  retryRefineEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'

export type SuggestionActions = {
  readonly ask: (handle: EditorHandle, instruction: Instruction) => void
  readonly retry: (handle: EditorHandle, id: SuggestionId) => void
  readonly refine: (
    handle: EditorHandle,
    id: SuggestionId,
    instruction: Instruction,
  ) => void
  readonly retryRefine: (handle: EditorHandle, id: SuggestionId) => void
}

export const suggestionActionsFacet = Facet.define<
  SuggestionActions,
  SuggestionActions | undefined
>({ combine: (values) => values.at(-1) })

type RuntimeOptions = {
  readonly client: Pick<ModelClient, 'requestSuggestion' | 'refineSuggestion'>
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

  const reconcile = (state: EditorState): void => {
    const inFlight = new Set(inFlightSuggestionIds(suggestionsOf(state)))
    for (const [id, controller] of controllers) {
      if (inFlight.has(id)) continue
      controller.abort()
      controllers.delete(id)
    }
  }

  const execute = async (
    handle: EditorHandle,
    id: SuggestionId,
    call: (signal: AbortSignal) => Promise<Result<SuggestionResult>>,
    settle: (result: Result<SuggestionResult>) => StateEffect<unknown>,
  ): Promise<void> => {
    const controller = new AbortController()
    controllers.set(id, controller)
    const result = await call(controller.signal)
    if (controllers.get(id) === controller) controllers.delete(id)
    if (controller.signal.aborted) return
    handle.dispatch({ effects: settle(result) })
  }

  const settleRequest =
    (id: SuggestionId) =>
    (result: Result<SuggestionResult>): StateEffect<unknown> =>
      result.ok
        ? resolveEffect.of({ id, result: result.value })
        : failEffect.of({ id, error: result.error })

  const settleRefine =
    (id: SuggestionId) =>
    (result: Result<SuggestionResult>): StateEffect<unknown> =>
      result.ok
        ? resolveRefineEffect.of({ id, result: result.value })
        : failRefineEffect.of({ id, error: result.error })

  const run = (
    handle: EditorHandle,
    id: SuggestionId,
    request: Parameters<typeof client.requestSuggestion>[0],
  ): Promise<void> =>
    execute(
      handle,
      id,
      (signal) => client.requestSuggestion({ ...request, signal }),
      settleRequest(id),
    )

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
    const target = targetFromRange(blocks, textOf(state), found, found.source)
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

  const runRefine = (
    handle: EditorHandle,
    found: ReadySuggestion,
    instruction: Instruction,
    begin: StateEffect<unknown>,
  ): void => {
    const blocks = blocksOf(handle.state)
    const target = targetFromRange(
      blocks,
      textOf(handle.state),
      found,
      found.source,
    )
    const request = {
      target,
      neighbors: getNeighbors(blocks, target),
      history: instructionHistory(found),
      latestReplacement: found.replacement,
      instruction: instruction.text,
      task: refineTaskLabel({ blocks: target.blocks, instruction }),
    }
    handle.dispatch({ effects: begin })
    void execute(
      handle,
      found.id,
      (signal) => client.refineSuggestion({ ...request, signal }),
      settleRefine(found.id),
    )
  }

  const refine = (
    handle: EditorHandle,
    id: SuggestionId,
    instruction: Instruction,
  ): void => {
    const found = findSuggestion(suggestionsOf(handle.state), id)
    if (found?.status !== 'ready' || found.refine.status === 'working') return
    runRefine(
      handle,
      found,
      instruction,
      beginRefineEffect.of({ id, instruction }),
    )
  }

  const retryRefine = (handle: EditorHandle, id: SuggestionId): void => {
    const found = findSuggestion(suggestionsOf(handle.state), id)
    if (found?.status !== 'ready' || found.refine.status !== 'failed') return
    runRefine(handle, found, found.refine.instruction, retryRefineEffect.of(id))
  }

  const actions: SuggestionActions = { ask, retry, refine, retryRefine }

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
