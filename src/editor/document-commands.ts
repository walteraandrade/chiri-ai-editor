import { isolateHistory } from '@codemirror/commands'
import { reviewActionsFacet } from './review-runtime'
import type { EditorHandle } from './suggestion-commands'
import { clearSuggestionsEffect } from './suggestion-field'

export const replaceDocument = (handle: EditorHandle, text: string): void => {
  handle.state.facet(reviewActionsFacet)?.stop(handle)
  handle.dispatch({ effects: clearSuggestionsEffect.of(null) })
  handle.dispatch({
    changes: { from: 0, to: handle.state.doc.length, insert: text },
    selection: { anchor: 0 },
    annotations: isolateHistory.of('full'),
    userEvent: 'input.open',
    scrollIntoView: true,
  })
}
