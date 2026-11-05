export type QuickActionId =
  | 'shorter'
  | 'clearer'
  | 'more-formal'
  | 'fix-grammar'
  | 'make-instruction'
  | 'cut-known'

export type QuickAction = {
  readonly id: QuickActionId
  readonly label: string
  readonly instruction: string
  readonly skillOnly?: boolean
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
  {
    id: 'make-instruction',
    label: 'Make this an instruction',
    skillOnly: true,
    instruction:
      'Rewrite the text as a direct instruction to the agent, in the imperative mood. Keep every requirement and do not add new ones.',
  },
  {
    id: 'cut-known',
    label: 'Cut what the agent already knows',
    skillOnly: true,
    instruction:
      'Remove explanations of things a capable coding agent already knows, such as general programming concepts and tool basics. Keep what is specific to this task, this project or this team.',
  },
]

export const quickActionsFor = (isSkill: boolean): readonly QuickAction[] =>
  QUICK_ACTIONS.filter((action) => isSkill || action.skillOnly !== true)

export const getQuickAction = (id: QuickActionId): QuickAction => {
  const action = QUICK_ACTIONS.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`Unknown Quick action: ${id}`)
  return action
}
