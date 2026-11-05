import type { EditorState } from '@codemirror/state'
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { instructionLabel } from '../suggestions/instruction'
import type { Suggestion } from '../suggestions/types'
import { aiFlag } from './ai-flag'
import { el } from './dom'
import { reviewRunField } from './review-field'
import { suggestionsField } from './suggestion-field'

export type AiCaret = { readonly pos: number; readonly label: string }

const REVIEW_LABEL = 'Reviewing'

const latest = (items: readonly Suggestion[]): Suggestion | undefined =>
  items.reduce<Suggestion | undefined>(
    (best, item) =>
      best === undefined || item.sequence > best.sequence ? item : best,
    undefined,
  )

export const aiCaretOf = (state: EditorState): AiCaret | null => {
  const items = state.field(suggestionsField, false)?.items ?? []
  const refining = items.flatMap((item) =>
    item.status === 'ready' && item.refine.status === 'working'
      ? [{ pos: item.to, label: instructionLabel(item.refine.instruction) }]
      : [],
  )[0]
  if (refining) return refining
  const pending = latest(items.filter((item) => item.status === 'pending'))
  if (pending)
    return { pos: pending.to, label: instructionLabel(pending.instruction) }
  if (!state.field(reviewRunField, false)) return null
  const reviewed = latest(items.filter((item) => item.origin === 'review'))
  return { pos: reviewed?.to ?? 0, label: REVIEW_LABEL }
}

const sameCaret = (a: AiCaret | null, b: AiCaret | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.pos === b.pos && a.label === b.label)

type Point = { readonly x: number; readonly y: number; readonly height: number }

type Measured = {
  readonly caret: AiCaret | null
  readonly at: Point | null
  readonly travelFrom: Point | null
  readonly flagOnLeft: boolean
}

const pointAt = (view: EditorView, pos: number, side: -1 | 1): Point | null => {
  const coords = view.coordsAtPos(pos, side)
  if (!coords) return null
  const rect = view.scrollDOM.getBoundingClientRect()
  return {
    x: (coords.left - rect.left) / view.scaleX + view.scrollDOM.scrollLeft,
    y: (coords.top - rect.top) / view.scaleY + view.scrollDOM.scrollTop,
    height: (coords.bottom - coords.top) / view.scaleY,
  }
}

const createCaretView = (view: EditorView) => {
  const label = el('span', { class: 'cm-ai-caret-label' })
  const flag = aiFlag('cm-ai-caret-flag', [
    label,
    el('span', { class: 'cm-ai-dots' }, [el('i'), el('i'), el('i')]),
  ])
  const bar = el('span', { class: 'cm-ai-caret-bar' })
  const dom = el(
    'div',
    { class: 'cm-ai-caret', attrs: { 'aria-hidden': 'true' } },
    [bar, flag],
  )
  view.scrollDOM.appendChild(dom)
  let shown = false

  const place = ({ x, y, height }: Point): void => {
    dom.style.transform = `translate(${x}px, ${y}px)`
    bar.style.height = `${height}px`
  }

  const read = (current: EditorView): Measured => {
    const caret = aiCaretOf(current.state)
    const at = caret ? pointAt(current, caret.pos, -1) : null
    const travelFrom =
      at && !shown
        ? pointAt(current, current.state.selection.main.head, 1)
        : null
    const flagOnLeft =
      at !== null &&
      at.x + flag.offsetWidth >
        current.scrollDOM.clientWidth + current.scrollDOM.scrollLeft
    return { caret, at, travelFrom, flagOnLeft }
  }

  const write = ({ caret, at, travelFrom, flagOnLeft }: Measured): void => {
    if (!caret || !at) {
      dom.classList.remove('is-visible')
      shown = false
      return
    }
    label.textContent = caret.label
    dom.classList.toggle('is-flipped', flagOnLeft)
    if (!shown) {
      dom.classList.add('is-placing')
      place(travelFrom ?? at)
      void dom.offsetWidth
      dom.classList.remove('is-placing')
    }
    place(at)
    dom.classList.add('is-visible')
    shown = true
  }

  const measure = { key: dom, read, write }

  return {
    update: (update: ViewUpdate) => {
      const before = aiCaretOf(update.startState)
      const after = aiCaretOf(update.state)
      if (before === null && after === null) return
      if (
        !sameCaret(before, after) ||
        update.geometryChanged ||
        update.docChanged ||
        update.viewportChanged
      )
        update.view.requestMeasure(measure)
    },
    destroy: () => dom.remove(),
  }
}

export const aiCaret = ViewPlugin.define(createCaretView)
