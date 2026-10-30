import type { EditorState } from '@codemirror/state'
import {
  EditorView,
  showTooltip,
  type Tooltip,
  type TooltipView,
  type ViewUpdate,
} from '@codemirror/view'
import {
  changeLabel,
  changeSpots,
  showsChanges,
  stepChange,
} from '../suggestions/changes'
import { describeError } from '../suggestions/error-message'
import {
  freeTextInstruction,
  instructionLabel,
} from '../suggestions/instruction'
import { findSuggestion } from '../suggestions/state'
import type { ReadySuggestion, SuggestionId } from '../suggestions/types'
import {
  detectApplePlatform,
  formatCtrlShortcut,
  formatShortcut,
} from '../ui/platform'
import {
  type CardPlacement,
  cardPlacementOf,
  MARGIN_CARD_WIDTH,
  marginAnchorAt,
  placementField,
} from './card-placement'
import { el, syncChildren } from './dom'
import { cycleTab } from './focus-cycle'
import { interactionField } from './interaction-state'
import { inViewCoords, lineRectAt } from './keep-in-view'
import {
  closeRefineEffect,
  openRefineEffect,
  refineInputOpenFor,
} from './refine-input'
import {
  acceptSuggestionById,
  rejectSuggestionById,
} from './suggestion-commands'
import {
  activeOf,
  cursorOf,
  showVersionEffect,
  suggestionsField,
  suggestionsOf,
} from './suggestion-field'
import { suggestionActionsFacet } from './suggestion-runtime'

type VersionView = {
  readonly index: number
  readonly count: number
  readonly instruction: string
  readonly locked: boolean
}

type CardContent = {
  readonly suggestion: ReadySuggestion
  readonly showRationale: boolean
  readonly showActions: boolean
  readonly refineOpen: boolean
  readonly version: VersionView | null
  readonly changes: string | null
}

type CardKind = 'active' | 'hover'

type PlacementSpec = {
  readonly side: Pick<Tooltip, 'above' | 'strictSide'>
  readonly attrs: Readonly<Record<string, string>>
  readonly alwaysShowRationale: boolean
  readonly position: (
    view: EditorView,
    kind: CardKind,
  ) => Pick<TooltipView, 'getCoords' | 'resize'>
}

const cardRange = (view: EditorView, kind: CardKind, pos: number) =>
  contentFor(kind, view.state)?.suggestion ?? { from: pos, to: pos }

const textAnchorAt = (view: EditorView, pos: number) =>
  view.coordsAtPos(pos) ??
  lineRectAt(view, pos, view.contentDOM.getBoundingClientRect().left)

const placements: Readonly<Record<CardPlacement, PlacementSpec>> = {
  floating: {
    side: { above: true },
    attrs: {},
    alwaysShowRationale: false,
    position: (view, kind) => ({
      getCoords: (pos) =>
        inViewCoords(view, textAnchorAt(view, pos), cardRange(view, kind, pos)),
    }),
  },
  margin: {
    side: { above: false, strictSide: true },
    attrs: { style: `width: ${MARGIN_CARD_WIDTH}px` },
    alwaysShowRationale: true,
    position: (view, kind) => ({
      getCoords: (pos) =>
        inViewCoords(
          view,
          marginAnchorAt(view, pos),
          cardRange(view, kind, pos),
        ),
      resize: false,
    }),
  },
}

const versionOf = ({
  history,
  shown,
  refine,
}: ReadySuggestion): VersionView | null => {
  const step = history[shown]
  return history.length < 2 || step === undefined
    ? null
    : {
        index: shown,
        count: history.length,
        instruction: instructionLabel(step.instruction),
        locked: refine.status === 'working',
      }
}

export const contentFor = (
  kind: CardKind,
  state: EditorState,
): CardContent | undefined => {
  const hoveredId = state.field(interactionField).hoveredId
  const active = activeOf(state)
  if (kind === 'active') {
    if (!active) return undefined
    const cursorInside =
      active.from <= cursorOf(state) && cursorOf(state) <= active.to
    return {
      suggestion: active,
      showRationale:
        placements[cardPlacementOf(state)].alwaysShowRationale ||
        cursorInside ||
        hoveredId === active.id,
      showActions: true,
      refineOpen: refineInputOpenFor(state) === active.id,
      version: versionOf(active),
      changes: showsChanges(active)
        ? changeLabel(changeSpots(active), cursorOf(state))
        : null,
    }
  }
  if (hoveredId === null || hoveredId === active?.id) return undefined
  const hovered = findSuggestion(suggestionsOf(state), hoveredId)
  return hovered?.status === 'ready'
    ? {
        suggestion: hovered,
        showRationale: true,
        showActions: false,
        refineOpen: false,
        version: null,
        changes: null,
      }
    : undefined
}

const refineKey = ({ refine }: ReadySuggestion): string =>
  refine.status === 'failed'
    ? `failed:${describeError(refine.error)}`
    : refine.status

const versionKey = (version: VersionView | null): string =>
  version === null
    ? ''
    : [version.index, version.count, version.instruction, version.locked].join(
        '/',
      )

const contentKey = ({
  suggestion,
  showRationale,
  showActions,
  refineOpen,
  version,
  changes,
}: CardContent): string =>
  [
    suggestion.id,
    suggestion.rationale,
    showRationale,
    showActions,
    refineOpen,
    refineKey(suggestion),
    versionKey(version),
    changes ?? '',
  ].join('\u0000')

const shortcutLabel = (key: string): string =>
  formatShortcut(key, detectApplePlatform())

type ButtonOptions = {
  readonly refocus?: boolean
  readonly disabled?: boolean
  readonly busy?: boolean
  readonly expanded?: boolean
}

const actionButton = (
  view: EditorView,
  label: string,
  hint: string | undefined,
  run: () => void,
  {
    refocus = true,
    disabled = false,
    busy = false,
    expanded,
  }: ButtonOptions = {},
) =>
  el(
    'button',
    {
      class: 'cm-ai-button',
      attrs: {
        type: 'button',
        ...(disabled && { disabled: '' }),
        ...(busy && { 'aria-busy': 'true' }),
        ...(expanded !== undefined && { 'aria-expanded': String(expanded) }),
      },
      on: {
        mousedown: (event) => event.preventDefault(),
        click: () => {
          run()
          if (refocus) view.focus()
        },
      },
    },
    hint === undefined
      ? [label]
      : [label, el('kbd', { class: 'cm-ai-kbd' }, [hint])],
  )

type RefineForm = {
  readonly form: HTMLFormElement
  readonly input: HTMLInputElement
}

const createRefineForm = (view: EditorView): RefineForm => {
  const input = el('input', {
    class: 'cm-ai-bubble-input',
    attrs: {
      type: 'text',
      placeholder: 'Refine: make it shorter…',
      'aria-label': 'Refine instruction',
      autocomplete: 'off',
      spellcheck: 'false',
    },
    on: {
      keydown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          input.value = ''
          view.dispatch({ effects: closeRefineEffect.of(null) })
          view.focus()
        } else if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
        }
      },
    },
  })
  const form = el(
    'form',
    {
      class: 'cm-ai-refine',
      on: {
        submit: (event) => {
          event.preventDefault()
          const id = refineInputOpenFor(view.state)
          const text = input.value.trim()
          if (id === null || text === '') return
          input.value = ''
          view.state
            .facet(suggestionActionsFacet)
            ?.refine(view, id, freeTextInstruction(text))
          view.focus()
        },
      },
    },
    [input],
  )
  return { form, input }
}

const VERSION_KEY_OFFSETS: Readonly<Record<string, number>> = { h: -1, l: 1 }

export const versionKeyOffset = (
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'
  >,
): number | undefined =>
  event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
    ? VERSION_KEY_OFFSETS[event.key.toLowerCase()]
    : undefined

const stepActiveVersion = (view: EditorView, offset: number): boolean => {
  const content = contentFor('active', view.state)
  if (!content?.version) return false
  view.dispatch({
    effects: showVersionEffect.of({
      id: content.suggestion.id,
      index: content.version.index + offset,
    }),
  })
  return true
}

type VersionNav = {
  readonly render: (version: VersionView) => HTMLElement
}

const createVersionNav = (view: EditorView): VersionNav => {
  const stepButton = (
    label: string,
    glyph: string,
    key: string,
    offset: number,
  ) =>
    el(
      'button',
      {
        class: 'cm-ai-button cm-ai-version-step',
        attrs: {
          type: 'button',
          'aria-label': label,
          'aria-keyshortcuts': `Control+${key}`,
          title: `${label} (${formatCtrlShortcut(key, detectApplePlatform())})`,
        },
        on: { click: () => stepActiveVersion(view, offset) },
      },
      [glyph],
    )
  const previous = stepButton('Previous version', '‹', 'H', -1)
  const next = stepButton('Next version', '›', 'L', 1)
  const count = el('span', {
    class: 'cm-ai-version-count',
    attrs: { 'aria-live': 'polite' },
  })
  const instruction = el('span', { class: 'cm-ai-version-instruction' })
  const dom = el(
    'div',
    {
      class: 'cm-ai-version',
      attrs: { role: 'group', 'aria-label': 'Versions' },
    },
    [previous, count, next, instruction],
  )
  return {
    render: (version) => {
      const focused = dom.ownerDocument.activeElement
      previous.disabled = version.locked || version.index === 0
      next.disabled = version.locked || version.index === version.count - 1
      count.textContent = `${version.index + 1} / ${version.count}`
      instruction.textContent = version.instruction
      instruction.title = version.instruction
      const stuck = [previous, next].find(
        (button) => button === focused && button.disabled,
      )
      const other = stuck === previous ? next : previous
      if (stuck !== undefined && !other.disabled) other.focus()
      return dom
    },
  }
}

const stepActiveChange = (view: EditorView, direction: 1 | -1): void => {
  const active = activeOf(view.state)
  if (!active) return
  const target = stepChange(
    changeSpots(active),
    cursorOf(view.state),
    direction,
  )
  if (target === undefined) return
  view.dispatch({
    selection: { anchor: target },
    effects: EditorView.scrollIntoView(target, { y: 'center' }),
  })
}

type ChangeNav = {
  readonly render: (label: string) => HTMLElement
}

const createChangeNav = (view: EditorView): ChangeNav => {
  const stepButton = (label: string, glyph: string, direction: 1 | -1) =>
    el(
      'button',
      {
        class: 'cm-ai-button cm-ai-version-step',
        attrs: { type: 'button', 'aria-label': label, title: label },
        on: { click: () => stepActiveChange(view, direction) },
      },
      [glyph],
    )
  const count = el('span', {
    class: 'cm-ai-changes-count',
    attrs: { 'aria-live': 'polite' },
  })
  const dom = el(
    'div',
    {
      class: 'cm-ai-changes',
      attrs: { role: 'group', 'aria-label': 'Changes' },
    },
    [
      count,
      stepButton('Previous change', '↑', -1),
      stepButton('Next change', '↓', 1),
    ],
  )
  return {
    render: (label) => {
      count.textContent = label
      return dom
    },
  }
}

const refineButton = (
  view: EditorView,
  { suggestion, refineOpen }: CardContent,
) =>
  suggestion.refine.status === 'working'
    ? actionButton(view, 'Refining…', undefined, () => undefined, {
        disabled: true,
        busy: true,
      })
    : actionButton(
        view,
        'Refine',
        shortcutLabel('K'),
        () =>
          view.dispatch({
            effects: refineOpen
              ? closeRefineEffect.of(null)
              : openRefineEffect.of(suggestion.id),
          }),
        { refocus: refineOpen, expanded: refineOpen },
      )

const refineError = (
  view: EditorView,
  { refine, id }: ReadySuggestion,
  withRetry: boolean,
) =>
  refine.status === 'failed'
    ? [
        el('div', { class: 'cm-ai-card-error', attrs: { role: 'alert' } }, [
          el('span', { class: 'cm-ai-error-message' }, [
            describeError(refine.error),
          ]),
          ...(withRetry
            ? [
                actionButton(view, 'Retry', undefined, () =>
                  view.state
                    .facet(suggestionActionsFacet)
                    ?.retryRefine(view, id),
                ),
              ]
            : []),
        ]),
      ]
    : []

const renderCard = (
  view: EditorView,
  content: CardContent,
  { form }: RefineForm,
  versionNav: VersionNav,
  changeNav: ChangeNav,
): Node[] => {
  const {
    suggestion,
    showRationale,
    showActions,
    refineOpen,
    version,
    changes,
  } = content
  return [
    ...(version === null ? [] : [versionNav.render(version)]),
    ...(showRationale
      ? [el('p', { class: 'cm-ai-rationale' }, [suggestion.rationale])]
      : []),
    ...(changes === null ? [] : [changeNav.render(changes)]),
    ...(showActions
      ? [
          el('div', { class: 'cm-ai-card-actions' }, [
            actionButton(view, 'Accept', shortcutLabel('↵'), () =>
              acceptSuggestionById(view, suggestion.id),
            ),
            actionButton(view, 'Reject', 'Esc', () =>
              rejectSuggestionById(view, suggestion.id),
            ),
            refineButton(view, content),
          ]),
          ...(refineOpen ? [form] : []),
        ]
      : []),
    ...refineError(view, suggestion, showActions),
  ]
}

const openedRefine = (update: ViewUpdate): boolean =>
  update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(openRefineEffect)),
  )

const cardCreator =
  (kind: CardKind, placement: CardPlacement) =>
  (view: EditorView): TooltipView => {
    const refineForm = createRefineForm(view)
    const versionNav = createVersionNav(view)
    const changeNav = createChangeNav(view)
    const dom = el('div', {
      class: `cm-ai-card cm-ai-card-${kind} cm-ai-card-${placement}`,
      attrs: {
        ...placements[placement].attrs,
        ...(kind === 'active' && { role: 'group', 'aria-label': 'Suggestion' }),
      },
      on: {
        mousedown: (event) => {
          if (event.target !== refineForm.input) event.preventDefault()
        },
        keydown: (event) => {
          const offset = versionKeyOffset(event)
          if (
            kind === 'active' &&
            offset !== undefined &&
            event.target !== refineForm.input &&
            stepActiveVersion(view, offset)
          )
            return event.preventDefault()
          if (event.key !== 'Escape') return cycleTab(dom, event)
          event.preventDefault()
          view.focus()
        },
      },
    })
    let renderedKey = ''
    let formOwner: SuggestionId | null = null
    const syncFormOwner = (state: EditorState): void => {
      const next = refineInputOpenFor(state)
      if (next === formOwner) return
      formOwner = next
      refineForm.input.value = ''
    }
    const sync = (state: EditorState): void => {
      syncFormOwner(state)
      const content = contentFor(kind, state)
      if (!content) return
      const key = contentKey(content)
      if (key === renderedKey) return
      renderedKey = key
      syncChildren(
        dom,
        renderCard(view, content, refineForm, versionNav, changeNav),
      )
    }
    sync(view.state)
    return {
      dom,
      ...placements[placement].position(view, kind),
      update: (update) => {
        sync(update.state)
        if (openedRefine(update) && refineForm.form.isConnected)
          refineForm.input.focus()
      },
    }
  }

const creators: Readonly<
  Record<CardPlacement, Record<CardKind, (view: EditorView) => TooltipView>>
> = {
  floating: {
    active: cardCreator('active', 'floating'),
    hover: cardCreator('hover', 'floating'),
  },
  margin: {
    active: cardCreator('active', 'margin'),
    hover: cardCreator('hover', 'margin'),
  },
}

const tooltipFor = (kind: CardKind, state: EditorState): Tooltip | null => {
  const content = contentFor(kind, state)
  if (!content) return null
  const placement = cardPlacementOf(state)
  return {
    pos: content.suggestion.from,
    clip: false,
    create: creators[placement][kind],
    ...placements[placement].side,
  }
}

export const suggestionCards = showTooltip.computeN(
  [suggestionsField, interactionField, placementField, 'selection'],
  (state) => [tooltipFor('active', state), tooltipFor('hover', state)],
)
