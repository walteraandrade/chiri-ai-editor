import { Facet } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import type { ModelClient } from '../ai/client'
import {
  type DropReason,
  MAX_REVIEW_EDITS,
  type ValidatedEdit,
} from '../ai/edits'
import type { ClientError } from '../ai/errors'
import {
  occupiedBlockIds,
  placeReviewEdit,
  reviewNoticeText,
  reviewSummary,
  reviewTaskLabel,
} from '../suggestions/review'
import type { SuggestionId } from '../suggestions/types'
import { blocksOf, textOf } from './current-target'
import {
  endReviewEffect,
  reviewRunField,
  reviewRunOf,
  reviewTallyEffect,
  startReviewEffect,
} from './review-field'
import type { EditorHandle } from './suggestion-commands'
import { beginEffect, resolveEffect, suggestionsOf } from './suggestion-field'

export type ReviewNotice = {
  readonly text: string
  readonly retry?: () => void
}

export type ReviewDropReason = DropReason | 'text-changed'

export type ReviewDrop = {
  readonly blockId: string
  readonly reason: ReviewDropReason
}

export type ReviewActions = {
  readonly start: (handle: EditorHandle, focus: string) => void
  readonly stop: (handle: EditorHandle) => void
}

export const reviewActionsFacet = Facet.define<
  ReviewActions,
  ReviewActions | undefined
>({ combine: (values) => values.at(-1) })

type RuntimeOptions = {
  readonly client: Pick<ModelClient, 'reviewDocument'>
  readonly onNotice: (notice: ReviewNotice) => void
  readonly onDrop?: (drop: ReviewDrop) => void
  readonly onEnd?: () => void
  readonly createId?: () => SuggestionId
}

export const createReviewRuntime = ({
  client,
  onNotice,
  onDrop,
  onEnd,
  createId = (() => {
    let counter = 0
    return () => `r${++counter}`
  })(),
}: RuntimeOptions) => {
  let current: AbortController | undefined
  let destroyed = false

  const recordDrop = (
    handle: EditorHandle,
    blockId: string,
    reason: ReviewDropReason,
  ): void => {
    handle.dispatch({ effects: reviewTallyEffect.of('dropped') })
    onDrop?.({ blockId, reason })
  }

  const place = (
    handle: EditorHandle,
    edit: ValidatedEdit,
    focus: string,
  ): void => {
    const run = reviewRunOf(handle.state)
    if (run === null) return
    if (run.added >= MAX_REVIEW_EDITS) {
      recordDrop(handle, edit.blockId, 'over-limit')
      return
    }
    const id = createId()
    const placement = placeReviewEdit({
      state: suggestionsOf(handle.state),
      edit,
      changes: run.changes,
      doc: textOf(handle.state),
      id,
      focus,
    })
    if (placement.type === 'dropped') {
      recordDrop(handle, edit.blockId, placement.reason)
      return
    }
    handle.dispatch({
      effects: [
        beginEffect.of(placement.draft),
        resolveEffect.of({ id, result: placement.result }),
        reviewTallyEffect.of('added'),
      ],
    })
  }

  const finish = (
    handle: EditorHandle,
    controller: AbortController,
    focus: string,
    failure: ClientError | undefined,
  ): void => {
    if (current === controller) current = undefined
    const added = reviewRunOf(handle.state)?.added ?? 0
    handle.dispatch({ effects: endReviewEffect.of(null) })
    onNotice({
      text: reviewNoticeText({ added, error: failure }),
      ...(failure !== undefined && { retry: () => start(handle, focus) }),
    })
    onEnd?.()
  }

  const consume = async (
    handle: EditorHandle,
    controller: AbortController,
    request: Parameters<typeof client.reviewDocument>[0],
    focus: string,
  ): Promise<void> => {
    let failure: ClientError | undefined
    try {
      for await (const event of client.reviewDocument(request)) {
        if (controller.signal.aborted) break
        if (event.type === 'edit') place(handle, event.edit, focus)
        else if (event.type === 'dropped')
          recordDrop(handle, event.edit.blockId, event.reason)
        else {
          failure = event.error
          break
        }
      }
    } catch (error) {
      failure = {
        type: 'unknown',
        message: error instanceof Error ? error.message : String(error),
      }
    }
    if (!controller.signal.aborted) finish(handle, controller, focus, failure)
  }

  const start = (handle: EditorHandle, rawFocus: string): void => {
    if (
      destroyed ||
      current !== undefined ||
      reviewRunOf(handle.state) !== null
    )
      return
    const focus = rawFocus.trim()
    const blocks = blocksOf(handle.state)
    const occupied = occupiedBlockIds(suggestionsOf(handle.state), blocks)
    if (
      !blocks.some((block) => block.kind !== 'code' && !occupied.has(block.id))
    ) {
      onNotice({ text: reviewSummary({ added: 0, stopped: false }) })
      return
    }
    const controller = new AbortController()
    current = controller
    handle.dispatch({ effects: startReviewEffect.of({ focus }) })
    void consume(
      handle,
      controller,
      {
        blocks,
        focus,
        occupied,
        task: reviewTaskLabel(focus),
        signal: controller.signal,
      },
      focus,
    )
  }

  const stop = (handle: EditorHandle): void => {
    const controller = current
    if (controller === undefined) return
    current = undefined
    controller.abort()
    const added = reviewRunOf(handle.state)?.added ?? 0
    handle.dispatch({ effects: endReviewEffect.of(null) })
    onNotice({ text: reviewSummary({ added, stopped: true }) })
    onEnd?.()
  }

  const destroy = (): void => {
    destroyed = true
    current?.abort()
    current = undefined
  }

  const actions: ReviewActions = { start, stop }

  const extension = [
    reviewRunField,
    reviewActionsFacet.of(actions),
    ViewPlugin.define(() => ({ destroy })),
  ]

  return { actions, extension, destroy }
}
