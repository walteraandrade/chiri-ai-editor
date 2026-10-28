import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { ModelClient } from '../ai/client'
import type { SuggestionNotice } from '../suggestions/types'
import { askBubble } from './ask-bubble'
import { interactionState } from './interaction-state'
import { suggestionCards } from './suggestion-cards'
import { suggestionDecorations } from './suggestion-decorations'
import { suggestionsField, suggestionsOf } from './suggestion-field'
import { suggestionKeymap } from './suggestion-keymap'
import { createSuggestionRuntime } from './suggestion-runtime'

type SuggestionExtensionOptions = {
  readonly client: Pick<ModelClient, 'requestSuggestion'>
  readonly onNotice: (notice: SuggestionNotice) => void
}

export const suggestionExtensions = ({
  client,
  onNotice,
}: SuggestionExtensionOptions): readonly Extension[] => [
  suggestionsField,
  interactionState,
  askBubble,
  createSuggestionRuntime({ client }).extension,
  suggestionDecorations,
  suggestionCards,
  suggestionKeymap,
  EditorView.updateListener.of((update) => {
    const before = suggestionsOf(update.startState).notice
    const after = suggestionsOf(update.state).notice
    if (after && after.serial !== before?.serial) onNotice(after)
  }),
]
