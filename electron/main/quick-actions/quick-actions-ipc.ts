import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  parseQuickActionSettings,
  serializeQuickActionSettings,
} from '../../../src/ai/quick-action-settings'
import {
  QUICK_ACTIONS_LOAD_CHANNEL,
  QUICK_ACTIONS_SAVE_CHANNEL,
} from '../../api'
import { codeIs } from '../files/fs-failure'
import { writeAtomic } from '../files/write-atomic'

export const QUICK_ACTIONS_FILE_NAME = 'quick-actions.json'

const MAX_TEXT_LENGTH = 256 * 1024

type QuickActionsIpcDeps<Event> = {
  readonly ipc: {
    readonly handle: (
      channel: string,
      handler: (event: Event, ...args: unknown[]) => unknown,
    ) => void
  }
  readonly userDataDir: string
  readonly isTrusted: (event: Event) => boolean
}

const canonicalText = (input: unknown): string => {
  const settings =
    typeof input === 'string' && input.length <= MAX_TEXT_LENGTH
      ? parseQuickActionSettings(input)
      : null
  if (settings === null) throw new Error('Invalid Quick actions')
  return serializeQuickActionSettings(settings)
}

export const registerQuickActionsIpc = <Event>({
  ipc,
  userDataDir,
  isTrusted,
}: QuickActionsIpcDeps<Event>): void => {
  const file = join(userDataDir, QUICK_ACTIONS_FILE_NAME)
  const trusted = (event: Event): void => {
    if (!isTrusted(event)) throw new Error('Untrusted sender')
  }

  ipc.handle(QUICK_ACTIONS_LOAD_CHANNEL, async (event) => {
    trusted(event)
    try {
      return await readFile(file, 'utf8')
    } catch (error) {
      if (codeIs(error, 'ENOENT')) return null
      throw error
    }
  })
  ipc.handle(QUICK_ACTIONS_SAVE_CHANNEL, async (event, input) => {
    trusted(event)
    await writeAtomic(file, canonicalText(input))
  })
}
