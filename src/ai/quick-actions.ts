export type QuickActionId =
  | 'shorter'
  | 'clearer'
  | 'more-formal'
  | 'fix-grammar'

export type QuickAction = {
  readonly id: QuickActionId
  readonly label: string
  readonly instruction: string
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'shorter',
    label: 'Shorter',
    instruction:
      'Make the text shorter. Remove redundancy and filler, and keep every key point.',
  },
  {
    id: 'clearer',
    label: 'Clearer',
    instruction:
      'Make the text clearer and easier to follow. Keep the meaning and the level of detail.',
  },
  {
    id: 'more-formal',
    label: 'More formal',
    instruction:
      'Make the tone more formal and professional. Keep the meaning and the level of detail.',
  },
  {
    id: 'fix-grammar',
    label: 'Fix grammar',
    instruction:
      'Fix grammar, spelling and punctuation errors only. Do not rephrase anything else.',
  },
]

export const getQuickAction = (id: QuickActionId): QuickAction => {
  const action = QUICK_ACTIONS.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`Unknown Quick action: ${id}`)
  return action
}
