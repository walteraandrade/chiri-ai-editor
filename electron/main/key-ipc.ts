import {
  KEY_CLEAR_CHANNEL,
  KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
  KEY_SAVE_CHANNEL,
  KEY_STATE_CHANNEL,
  type KeyDetails,
  type KeyState,
} from '../api'
import { parseKeyInput } from './key-input'
import type { KeyStore } from './key-store'

type KeyIpcDeps<Event> = {
  readonly ipc: {
    readonly handle: (
      channel: string,
      handler: (event: Event, ...args: unknown[]) => unknown,
    ) => void
  }
  readonly store: KeyStore
  readonly managed: boolean
  readonly isTrusted: (event: Event) => boolean
}

export const registerKeyIpc = <Event>({
  ipc,
  store,
  managed,
  isTrusted,
}: KeyIpcDeps<Event>): void => {
  const state = (details: KeyDetails): KeyState => ({ managed, ...details })

  const trusted = (event: Event): void => {
    if (!isTrusted(event)) throw new Error('Untrusted sender')
  }

  const change =
    (action: (...args: unknown[]) => Promise<KeyDetails>) =>
    async (event: Event, ...args: unknown[]): Promise<KeyState> => {
      trusted(event)
      if (!managed)
        throw new Error('Key settings are not available in this run')
      return state(await action(...args))
    }

  ipc.handle(KEY_STATE_CHANNEL, (event): KeyState => {
    trusted(event)
    return state(store.status())
  })
  ipc.handle(
    KEY_SAVE_CHANNEL,
    change((key) => store.save(parseKeyInput(key))),
  )
  ipc.handle(
    KEY_KEEP_AS_PLAIN_TEXT_CHANNEL,
    change(() => store.keepAsPlainText()),
  )
  ipc.handle(
    KEY_CLEAR_CHANNEL,
    change(() => store.clear()),
  )
}
