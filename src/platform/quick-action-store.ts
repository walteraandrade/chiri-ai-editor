import {
  DEFAULT_QUICK_ACTION_SETTINGS,
  parseQuickActionSettings,
  type QuickActionSettings,
  serializeQuickActionSettings,
} from '../ai/quick-action-settings'
import type { StorageLike } from '../document/storage'

export const QUICK_ACTIONS_STORAGE_KEY = 'chiri.quickActions'

export type QuickActionStore = {
  readonly load: () => Promise<QuickActionSettings>
  readonly save: (settings: QuickActionSettings) => Promise<void>
}

type TextStore = {
  readonly read: () => Promise<string | null>
  readonly write: (text: string) => Promise<void>
}

const readSettings = async (
  read: TextStore['read'],
): Promise<QuickActionSettings> => {
  try {
    const text = await read()
    return text === null
      ? DEFAULT_QUICK_ACTION_SETTINGS
      : (parseQuickActionSettings(text) ?? DEFAULT_QUICK_ACTION_SETTINGS)
  } catch (error) {
    console.error('Quick actions could not be read', error)
    return DEFAULT_QUICK_ACTION_SETTINGS
  }
}

export const createQuickActionStore = ({
  read,
  write,
}: TextStore): QuickActionStore => ({
  load: () => readSettings(read),
  save: (settings) => write(serializeQuickActionSettings(settings)),
})

export const localQuickActionStore = (
  storage: StorageLike | null,
): QuickActionStore =>
  createQuickActionStore({
    read: async () => storage?.getItem(QUICK_ACTIONS_STORAGE_KEY) ?? null,
    write: async (text) => {
      if (storage === null) throw new Error('No storage for Quick actions')
      storage.setItem(QUICK_ACTIONS_STORAGE_KEY, text)
    },
  })
