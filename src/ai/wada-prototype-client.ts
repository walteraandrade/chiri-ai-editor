// PROTOTYPE, throwaway: canned Suggestions so the AI colors show without calling the model.
import type { ModelClient, ReviewRequest, TargetRequest } from './client'

type SuggestionClient = Pick<
  ModelClient,
  'requestSuggestion' | 'refineSuggestion' | 'reviewDocument'
>

const REPLACEMENT_PREFIX = 'In short: '

const cannedReplacement = (text: string): string =>
  `${REPLACEMENT_PREFIX}${text.slice(0, Math.max(40, Math.floor(text.length * 0.6))).trim()}.`

const suggestionFor = ({ target }: TargetRequest) => ({
  ok: true as const,
  value: {
    replacement: cannedReplacement(target.text),
    rationale: 'Canned prototype Suggestion. No model was called.',
    unchanged: false,
  },
})

const reviewDocument = async function* ({ blocks }: ReviewRequest) {
  const paragraphs = blocks
    .filter((block) => block.kind === 'paragraph')
    .slice(0, 3)
  for (const block of paragraphs) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    yield {
      type: 'edit' as const,
      edit: {
        blockId: block.id,
        replacement: cannedReplacement(block.text),
        rationale: 'Canned prototype Suggestion. No model was called.',
        block,
      },
      elapsedMs: 300,
    }
  }
  yield {
    type: 'done' as const,
    validated: paragraphs.length,
    dropped: 0,
    attempts: 1,
    incomplete: false,
    firstSuggestionMs: 300,
  }
}

export const wadaPrototypeClient: SuggestionClient = {
  requestSuggestion: async (request) => suggestionFor(request),
  refineSuggestion: async (request) => suggestionFor(request),
  reviewDocument,
}
