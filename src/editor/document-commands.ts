import { isolateHistory } from '@codemirror/commands'
import { minimalChange } from './minimal-change'
import { reviewActionsFacet } from './review-runtime'
import type { EditorHandle } from './suggestion-commands'
import { clearSuggestionsEffect } from './suggestion-field'

export const replaceDocument = (
  handle: EditorHandle,
  text: string,
  userEvent: 'input.open' | 'input.restore' = 'input.open',
): void => {
  handle.state.facet(reviewActionsFacet)?.stop(handle)
  handle.dispatch({ effects: clearSuggestionsEffect.of(null) })
  handle.dispatch({
    changes: { from: 0, to: handle.state.doc.length, insert: text },
    selection: { anchor: 0 },
    annotations: isolateHistory.of('full'),
    userEvent,
    scrollIntoView: true,
  })
}

export const refreshDocument = (handle: EditorHandle, text: string): void => {
  handle.state.facet(reviewActionsFacet)?.stop(handle)
  handle.dispatch({ effects: clearSuggestionsEffect.of(null) })
  handle.dispatch({
    changes: minimalChange(handle.state.doc.toString(), text),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.open',
  })
}
