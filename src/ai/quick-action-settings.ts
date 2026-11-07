import {
  type BuiltInQuickActionId,
  DEFAULT_QUICK_ACTION_IDS,
  getQuickAction,
  isBuiltInQuickActionId,
  QUICK_ACTIONS,
  type QuickAction,
  type QuickActionId,
  quickActionsFor,
  type UserQuickActionId,
} from './quick-actions'

export type QuickActionSlot = {
  readonly action: QuickAction
  readonly on: boolean
}

export type QuickActionSettings = readonly QuickActionSlot[]

export type QuickActionDraft = {
  readonly label: string
  readonly instruction: string
  readonly skillOnly: boolean
}

export type QuickActionDraftErrors = {
  readonly label?: string
  readonly instruction?: string
}

export const MAX_LABEL_LENGTH = 40
export const MAX_INSTRUCTION_LENGTH = 2000

const SETTINGS_VERSION = 1
const USER_ID = /^user-[A-Za-z0-9-]{1,64}$/

const OFF_BUILT_INS = QUICK_ACTIONS.filter(
  (action) => !DEFAULT_QUICK_ACTION_IDS.includes(action.id),
)

export const DEFAULT_QUICK_ACTION_SETTINGS: QuickActionSettings = [
  ...DEFAULT_QUICK_ACTION_IDS.map((id) => ({
    action: getQuickAction(id),
    on: true,
  })),
  ...OFF_BUILT_INS.map((action) => ({ action, on: false })),
]

export const isUserQuickActionId = (id: string): id is UserQuickActionId =>
  USER_ID.test(id)

export const isUserQuickAction = (action: QuickAction): boolean =>
  isUserQuickActionId(action.id)

export const enabledQuickActions = (
  settings: QuickActionSettings,
  isSkill = true,
): readonly QuickAction[] =>
  quickActionsFor(
    isSkill,
    settings.filter((slot) => slot.on).map((slot) => slot.action),
  )

export const toggleQuickAction = (
  settings: QuickActionSettings,
  id: QuickActionId,
  on: boolean,
): QuickActionSettings =>
  settings.map((slot) => (slot.action.id === id ? { ...slot, on } : slot))

export const moveQuickAction = (
  settings: QuickActionSettings,
  id: QuickActionId,
  delta: -1 | 1,
): QuickActionSettings => {
  const from = settings.findIndex((slot) => slot.action.id === id)
  const moving = settings[from]
  const other = settings[from + delta]
  if (moving === undefined || other === undefined) return settings
  return settings.map((slot) =>
    slot === moving ? other : slot === other ? moving : slot,
  )
}

const userAction = (
  id: UserQuickActionId,
  draft: QuickActionDraft,
): QuickAction => ({
  id,
  label: draft.label.trim(),
  instruction: draft.instruction.trim(),
  skillOnly: draft.skillOnly,
})

export const addUserQuickAction = (
  settings: QuickActionSettings,
  draft: QuickActionDraft,
  id: UserQuickActionId,
): QuickActionSettings => [
  ...settings,
  { action: userAction(id, draft), on: true },
]

export const updateUserQuickAction = (
  settings: QuickActionSettings,
  id: QuickActionId,
  draft: QuickActionDraft,
): QuickActionSettings =>
  isUserQuickActionId(id) && settings.some((slot) => slot.action.id === id)
    ? settings.map((slot) =>
        slot.action.id === id
          ? { ...slot, action: userAction(id, draft) }
          : slot,
      )
    : settings

export const removeUserQuickAction = (
  settings: QuickActionSettings,
  id: QuickActionId,
): QuickActionSettings =>
  isUserQuickActionId(id)
    ? settings.filter((slot) => slot.action.id !== id)
    : settings

const sameLabel = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

const labelError = (
  settings: QuickActionSettings,
  label: string,
  editing: QuickActionId | undefined,
): string | undefined => {
  const trimmed = label.trim()
  if (trimmed === '') return 'Give it a name.'
  if (trimmed.length > MAX_LABEL_LENGTH)
    return `Keep it under ${MAX_LABEL_LENGTH} characters.`
  const taken = settings.some(
    (slot) => slot.action.id !== editing && sameLabel(slot.action.label, label),
  )
  return taken ? 'Another Quick action has this name.' : undefined
}

const instructionError = (instruction: string): string | undefined => {
  const trimmed = instruction.trim()
  if (trimmed === '') return 'Say what to do.'
  return trimmed.length > MAX_INSTRUCTION_LENGTH
    ? `Keep it under ${MAX_INSTRUCTION_LENGTH} characters.`
    : undefined
}

export const checkQuickActionDraft = (
  settings: QuickActionSettings,
  draft: QuickActionDraft,
  editing?: QuickActionId,
): QuickActionDraftErrors => {
  const label = labelError(settings, draft.label, editing)
  const instruction = instructionError(draft.instruction)
  return {
    ...(label === undefined ? {} : { label }),
    ...(instruction === undefined ? {} : { instruction }),
  }
}

export const draftIsValid = (errors: QuickActionDraftErrors): boolean =>
  errors.label === undefined && errors.instruction === undefined

type StoredSlot =
  | { readonly id: BuiltInQuickActionId; readonly on: boolean }
  | {
      readonly id: UserQuickActionId
      readonly on: boolean
      readonly label: string
      readonly instruction: string
      readonly skillOnly: boolean
    }

const storedSlot = ({ action, on }: QuickActionSlot): StoredSlot =>
  isUserQuickActionId(action.id)
    ? {
        id: action.id,
        on,
        label: action.label,
        instruction: action.instruction,
        skillOnly: action.skillOnly === true,
      }
    : { id: action.id as BuiltInQuickActionId, on }

export const serializeQuickActionSettings = (
  settings: QuickActionSettings,
): string =>
  `${JSON.stringify(
    { version: SETTINGS_VERSION, actions: settings.map(storedSlot) },
    null,
    2,
  )}\n`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readSlot = (
  value: unknown,
  kept: QuickActionSettings,
): QuickActionSlot | null => {
  if (!isRecord(value) || typeof value.on !== 'boolean') return null
  const { id, on } = value
  if (typeof id !== 'string') return null
  if (kept.some((slot) => slot.action.id === id)) return null
  if (isBuiltInQuickActionId(id)) return { action: getQuickAction(id), on }
  if (!isUserQuickActionId(id)) return null
  const draft = {
    label: typeof value.label === 'string' ? value.label : '',
    instruction: typeof value.instruction === 'string' ? value.instruction : '',
    skillOnly: value.skillOnly === true,
  }
  const reserved = [
    ...QUICK_ACTIONS.map((action) => ({ action, on: false })),
    ...kept,
  ]
  return draftIsValid(checkQuickActionDraft(reserved, draft))
    ? { action: userAction(id, draft), on }
    : null
}

const withMissingBuiltIns = (
  settings: QuickActionSettings,
): QuickActionSettings => [
  ...settings,
  ...QUICK_ACTIONS.filter(
    (action) => !settings.some((slot) => slot.action.id === action.id),
  ).map((action) => ({ action, on: false })),
]

export const parseQuickActionSettings = (
  text: string,
): QuickActionSettings | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      !isRecord(parsed) ||
      parsed.version !== SETTINGS_VERSION ||
      !Array.isArray(parsed.actions)
    )
      return null
    const slots = parsed.actions.reduce<QuickActionSlot[]>((kept, value) => {
      const slot = readSlot(value, kept)
      if (slot !== null) kept.push(slot)
      return kept
    }, [])
    return withMissingBuiltIns(slots)
  } catch {
    return null
  }
}
