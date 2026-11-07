export type BuiltInQuickActionId =
  | 'shorter'
  | 'clearer'
  | 'more-formal'
  | 'fix-grammar'
  | 'make-instruction'
  | 'cut-known'

export type UserQuickActionId = `user-${string}`

export type QuickActionId = BuiltInQuickActionId | UserQuickActionId

export type QuickAction = {
  readonly id: QuickActionId
  readonly label: string
  readonly instruction: string
  readonly skillOnly?: boolean
}

export type BuiltInQuickAction = QuickAction & {
  readonly id: BuiltInQuickActionId
}

export const QUICK_ACTIONS: readonly BuiltInQuickAction[] = [
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

export const DEFAULT_QUICK_ACTION_IDS: readonly BuiltInQuickActionId[] = [
  'shorter',
  'clearer',
  'fix-grammar',
]

export const isBuiltInQuickActionId = (
  id: string,
): id is BuiltInQuickActionId =>
  QUICK_ACTIONS.some((candidate) => candidate.id === id)

export const getQuickAction = (
  id: BuiltInQuickActionId,
): BuiltInQuickAction => {
  const action = QUICK_ACTIONS.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`Unknown Quick action: ${id}`)
  return action
}

export const DEFAULT_QUICK_ACTIONS: readonly QuickAction[] =
  DEFAULT_QUICK_ACTION_IDS.map(getQuickAction)

export const quickActionsFor = (
  isSkill: boolean,
  actions: readonly QuickAction[] = DEFAULT_QUICK_ACTIONS,
): readonly QuickAction[] =>
  actions.filter((action) => isSkill || action.skillOnly !== true)
