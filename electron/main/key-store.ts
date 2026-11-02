import type { KeyDetails, KeyStorage } from '../api'

export type SafeStorageLike = {
  readonly isEncryptionAvailable: () => boolean
  readonly getSelectedStorageBackend: () => string
  readonly encryptString: (plainText: string) => Buffer
  readonly decryptString: (encrypted: Buffer) => string
  readonly setUsePlainTextEncryption: (usePlainText: boolean) => void
}

export type KeyFile = {
  readonly read: () => Promise<string | null>
  readonly write: (content: string) => Promise<void>
  readonly remove: () => Promise<void>
}

export type KeyStore = {
  readonly load: () => Promise<KeyDetails>
  readonly save: (key: string) => Promise<KeyDetails>
  readonly keepAsPlainText: () => Promise<KeyDetails>
  readonly clear: () => Promise<KeyDetails>
  readonly status: () => KeyDetails
  readonly current: () => string | undefined
}

type StoredFormat = 'keyring' | 'plain-text'

type StoredKey = {
  readonly version: 1
  readonly storage: StoredFormat
  readonly data: string
}

type Held = {
  readonly key: string | undefined
  readonly storage: KeyStorage
  readonly unreadable: boolean
}

const NO_KEY: Held = { key: undefined, storage: 'none', unreadable: false }
const UNREADABLE: Held = { ...NO_KEY, unreadable: true }
const WEAK_BACKENDS: readonly string[] = ['basic_text', 'unknown']

export const chooseKeyStorage = ({
  encryptionAvailable,
  backend,
  plainTextAllowed,
}: {
  readonly encryptionAvailable: boolean
  readonly backend: string
  readonly plainTextAllowed: boolean
}): 'keyring' | 'plain-text' | 'session' =>
  encryptionAvailable && !WEAK_BACKENDS.includes(backend)
    ? 'keyring'
    : plainTextAllowed
      ? 'plain-text'
      : 'session'

const parseStored = (text: string): StoredKey | null => {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null
    const { version, storage, data } = value as Record<string, unknown>
    return version === 1 &&
      (storage === 'keyring' || storage === 'plain-text') &&
      typeof data === 'string'
      ? { version, storage, data }
      : null
  } catch {
    return null
  }
}

const serialize = (storage: StoredFormat, encrypted: Buffer): string =>
  JSON.stringify({
    version: 1,
    storage,
    data: encrypted.toString('base64'),
  } satisfies StoredKey)

export const createKeyStore = ({
  safeStorage,
  file,
}: {
  readonly safeStorage: SafeStorageLike
  readonly file: KeyFile
}): KeyStore => {
  let held: Held = NO_KEY

  const keyringAvailable = (): boolean =>
    chooseKeyStorage({
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      backend: safeStorage.getSelectedStorageBackend(),
      plainTextAllowed: false,
    }) === 'keyring'

  const status = (): KeyDetails => ({
    present: held.key !== undefined,
    storage: held.storage,
    keyringAvailable: keyringAvailable(),
    backend: safeStorage.getSelectedStorageBackend(),
    unreadable: held.unreadable,
  })

  const decrypt = (stored: StoredKey): Held => {
    try {
      if (stored.storage === 'plain-text')
        safeStorage.setUsePlainTextEncryption(true)
      else if (!keyringAvailable()) return UNREADABLE
      const key = safeStorage.decryptString(Buffer.from(stored.data, 'base64'))
      return key === ''
        ? UNREADABLE
        : { ...NO_KEY, key, storage: stored.storage }
    } catch {
      return UNREADABLE
    }
  }

  const load = async (): Promise<KeyDetails> => {
    const text = await file.read().catch(() => undefined)
    if (text === null) held = NO_KEY
    else {
      const stored = text === undefined ? null : parseStored(text)
      held = stored === null ? UNREADABLE : decrypt(stored)
    }
    return status()
  }

  const persist = async (
    key: string,
    format: StoredFormat,
  ): Promise<Held | null> => {
    try {
      await file.write(serialize(format, safeStorage.encryptString(key)))
      return { ...NO_KEY, key, storage: format }
    } catch {
      return null
    }
  }

  const storedFormat = async (): Promise<StoredFormat | null> => {
    const text = await file.read().catch(() => null)
    return (text === null ? null : parseStored(text))?.storage ?? null
  }

  const keepForSession = async (key: string): Promise<Held> => {
    if ((await storedFormat()) !== 'keyring') await file.remove()
    return { ...NO_KEY, key, storage: 'session' }
  }

  const save = async (key: string): Promise<KeyDetails> => {
    held =
      (keyringAvailable() ? await persist(key, 'keyring') : null) ??
      (await keepForSession(key))
    return status()
  }

  const keepAsPlainText = async (): Promise<KeyDetails> => {
    const { key, storage } = held
    if (key === undefined || storage !== 'session') return status()
    safeStorage.setUsePlainTextEncryption(true)
    held = (await persist(key, 'plain-text')) ?? held
    return status()
  }

  const clear = async (): Promise<KeyDetails> => {
    await file.remove()
    held = NO_KEY
    return status()
  }

  return { load, save, keepAsPlainText, clear, status, current: () => held.key }
}
