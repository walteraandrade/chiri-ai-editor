import { describe, expect, it } from 'vitest'
import {
  chooseKeyStorage,
  createKeyStore,
  type KeyFile,
  NATIVE_BACKEND,
  type SafeStorageLike,
} from './key-store'

const KEY = 'sk-or-v1-dummy-for-tests'

describe('chooseKeyStorage', () => {
  it('uses the keyring when a real backend can encrypt', () => {
    expect(
      chooseKeyStorage({
        encryptionAvailable: true,
        backend: 'gnome_libsecret',
        plainTextAllowed: false,
      }),
    ).toBe('keyring')
    expect(
      chooseKeyStorage({
        encryptionAvailable: true,
        backend: 'kwallet6',
        plainTextAllowed: true,
      }),
    ).toBe('keyring')
  })

  it('keeps the key for the session when encryption is not available and plain text is not allowed', () => {
    expect(
      chooseKeyStorage({
        encryptionAvailable: false,
        backend: 'basic_text',
        plainTextAllowed: false,
      }),
    ).toBe('session')
    expect(
      chooseKeyStorage({
        encryptionAvailable: false,
        backend: 'gnome_libsecret',
        plainTextAllowed: false,
      }),
    ).toBe('session')
  })

  it('stores plain text only when allowed', () => {
    expect(
      chooseKeyStorage({
        encryptionAvailable: false,
        backend: 'basic_text',
        plainTextAllowed: true,
      }),
    ).toBe('plain-text')
  })

  it('does not count basic_text or an unknown backend as a keyring, even when encryption reports available', () => {
    expect(
      chooseKeyStorage({
        encryptionAvailable: true,
        backend: 'basic_text',
        plainTextAllowed: false,
      }),
    ).toBe('session')
    expect(
      chooseKeyStorage({
        encryptionAvailable: true,
        backend: 'unknown',
        plainTextAllowed: false,
      }),
    ).toBe('session')
  })
})

type FakeSafeStorage = SafeStorageLike & {
  readonly plainTextCalls: boolean[]
  readonly setBroken: (broken: boolean) => void
}

const fakeSafeStorage = (
  backend: string,
  options: { readonly encrypts?: boolean } = {},
): FakeSafeStorage => {
  const plainTextCalls: boolean[] = []
  let plainText = false
  let broken = false
  const hasRealStore = backend !== 'basic_text'
  const available = (): boolean =>
    !broken && ((options.encrypts ?? hasRealStore) ? true : plainText)
  const currentBackend = (): string => backend
  return {
    plainTextCalls,
    setBroken: (value) => {
      broken = value
    },
    isEncryptionAvailable: available,
    getSelectedStorageBackend: currentBackend,
    encryptString: (text) => {
      if (!available()) throw new Error('Encryption is not available')
      return Buffer.from(
        `${currentBackend()}|${text.split('').reverse().join('')}`,
      )
    },
    decryptString: (buffer) => {
      const [stored, reversed = ''] = buffer.toString().split('|')
      if (!available() || stored !== currentBackend())
        throw new Error('Could not decrypt')
      return reversed.split('').reverse().join('')
    },
    setUsePlainTextEncryption: (value) => {
      plainText = value
      plainTextCalls.push(value)
    },
  }
}

type FakeFile = KeyFile & {
  readonly content: () => string | null
  readonly writes: () => number
  readonly removals: () => number
}

const fakeFile = (initial: string | null = null): FakeFile => {
  let content = initial
  let writes = 0
  let removals = 0
  return {
    read: async () => content,
    write: async (text) => {
      content = text
      writes += 1
    },
    remove: async () => {
      content = null
      removals += 1
    },
    content: () => content,
    writes: () => writes,
    removals: () => removals,
  }
}

const storeWith = (backend: string, file: FakeFile = fakeFile()) => {
  const safeStorage = fakeSafeStorage(backend)
  const store = createKeyStore({ safeStorage, file })
  return { store, safeStorage, file }
}

const withoutBackendQuery = (
  options: { readonly encrypts?: boolean } = {},
): SafeStorageLike => {
  const { getSelectedStorageBackend: _linuxOnly, ...rest } = fakeSafeStorage(
    NATIVE_BACKEND,
    options,
  )
  return rest
}

describe('createKeyStore: Windows and macOS, where safeStorage has no backend query', () => {
  it('saves to the keyring and reads the key back', async () => {
    const file = fakeFile()
    const status = await createKeyStore({
      safeStorage: withoutBackendQuery(),
      file,
    }).save(KEY)
    expect(status).toMatchObject({
      present: true,
      storage: 'keyring',
      keyringAvailable: true,
      backend: NATIVE_BACKEND,
    })
    const reopened = createKeyStore({
      safeStorage: withoutBackendQuery(),
      file,
    })
    expect(await reopened.load()).toMatchObject({ present: true })
    expect(reopened.current()).toBe(KEY)
  })

  it('keeps the key for the session when encryption is not available', async () => {
    const file = fakeFile()
    const status = await createKeyStore({
      safeStorage: withoutBackendQuery({ encrypts: false }),
      file,
    }).save(KEY)
    expect(status).toMatchObject({
      storage: 'session',
      keyringAvailable: false,
    })
    expect(file.writes()).toBe(0)
  })
})

describe('createKeyStore: saving', () => {
  it('encrypts the key into the file when the keyring works', async () => {
    const { store, file } = storeWith('gnome_libsecret')
    const status = await store.save(KEY)
    expect(status).toMatchObject({
      present: true,
      storage: 'keyring',
      keyringAvailable: true,
      backend: 'gnome_libsecret',
    })
    expect(store.current()).toBe(KEY)
    expect(file.content()).not.toBeNull()
    expect(file.content()).not.toContain(KEY)
    expect(JSON.parse(file.content() ?? '{}').storage).toBe('keyring')
  })

  it('keeps the key for the session, and writes nothing, when encryption is not available', async () => {
    const { store, file } = storeWith('basic_text')
    const status = await store.save(KEY)
    expect(status).toMatchObject({
      present: true,
      storage: 'session',
      keyringAvailable: false,
      backend: 'basic_text',
    })
    expect(store.current()).toBe(KEY)
    expect(file.writes()).toBe(0)
  })

  it('removes an older plain text key when the new one cannot be stored', async () => {
    const file = fakeFile('{"version":1,"storage":"plain-text","data":"AAAA"}')
    const { store } = storeWith('basic_text', file)
    await store.save(KEY)
    expect(file.content()).toBeNull()
  })

  it('keeps a stored keyring file when the keyring is unavailable and a key is saved', async () => {
    const writer = storeWith('gnome_libsecret')
    await writer.store.save(KEY)
    const content = writer.file.content()
    const file = fakeFile(content)
    const { store } = storeWith('basic_text', file)
    expect(await store.load()).toMatchObject({
      present: false,
      unreadable: true,
      keyringAvailable: false,
    })
    const status = await store.save('sk-or-v1-second')
    expect(status).toMatchObject({ present: true, storage: 'session' })
    expect(store.current()).toBe('sk-or-v1-second')
    expect(file.removals()).toBe(0)
    expect(file.content()).toBe(content)
  })

  it('keeps a stored keyring file when encrypting fails and the key falls back to the session', async () => {
    const writer = storeWith('gnome_libsecret')
    await writer.store.save(KEY)
    const content = writer.file.content()
    const file = fakeFile(content)
    const base = fakeSafeStorage('gnome_libsecret')
    const store = createKeyStore({
      safeStorage: {
        ...base,
        encryptString: () => {
          throw new Error('locked')
        },
      },
      file,
    })
    await store.load()
    const status = await store.save('sk-or-v1-second')
    expect(status.storage).toBe('session')
    expect(file.content()).toBe(content)
  })

  it('still lets Remove key delete a keyring file', async () => {
    const writer = storeWith('gnome_libsecret')
    await writer.store.save(KEY)
    const file = fakeFile(writer.file.content())
    const { store } = storeWith('basic_text', file)
    await store.load()
    await store.clear()
    expect(file.content()).toBeNull()
  })

  it('falls back to the session when the keyring fails while encrypting', async () => {
    const { store, safeStorage, file } = storeWith('gnome_libsecret')
    safeStorage.setBroken(true)
    const status = await store.save(KEY)
    expect(status.storage).toBe('session')
    expect(store.current()).toBe(KEY)
    expect(file.writes()).toBe(0)
  })

  it('falls back to the session when encrypting throws although the keyring reports available', async () => {
    const base = fakeSafeStorage('gnome_libsecret')
    const file = fakeFile()
    const store = createKeyStore({
      safeStorage: {
        ...base,
        encryptString: () => {
          throw new Error('locked')
        },
      },
      file,
    })
    const status = await store.save(KEY)
    expect(status.storage).toBe('session')
    expect(store.current()).toBe(KEY)
    expect(file.writes()).toBe(0)
  })

  it('replaces the previous key', async () => {
    const { store } = storeWith('gnome_libsecret')
    await store.save(KEY)
    await store.save('sk-or-v1-second')
    expect(store.current()).toBe('sk-or-v1-second')
  })
})

describe('createKeyStore: plain text', () => {
  it('stores the session key as plain text only when asked', async () => {
    const { store, safeStorage, file } = storeWith('basic_text')
    await store.save(KEY)
    expect(safeStorage.plainTextCalls).toEqual([])
    const status = await store.keepAsPlainText()
    expect(safeStorage.plainTextCalls).toEqual([true])
    expect(status.storage).toBe('plain-text')
    expect(JSON.parse(file.content() ?? '{}').storage).toBe('plain-text')
    expect(store.current()).toBe(KEY)
  })

  it('does nothing without a session key', async () => {
    const { store, safeStorage, file } = storeWith('basic_text')
    const status = await store.keepAsPlainText()
    expect(status.present).toBe(false)
    expect(safeStorage.plainTextCalls).toEqual([])
    expect(file.writes()).toBe(0)
  })

  it('does nothing when the key is already in the keyring', async () => {
    const { store, safeStorage, file } = storeWith('gnome_libsecret')
    await store.save(KEY)
    const writes = file.writes()
    const status = await store.keepAsPlainText()
    expect(status.storage).toBe('keyring')
    expect(safeStorage.plainTextCalls).toEqual([])
    expect(file.writes()).toBe(writes)
  })
})

describe('createKeyStore: loading', () => {
  const stored = async (backend: string) => {
    const writer = storeWith(backend)
    await writer.store.save(KEY)
    if (backend === 'basic_text') await writer.store.keepAsPlainText()
    return writer.file.content()
  }

  it('reads a stored key back', async () => {
    const content = await stored('gnome_libsecret')
    const { store } = storeWith('gnome_libsecret', fakeFile(content))
    const status = await store.load()
    expect(status).toMatchObject({ present: true, storage: 'keyring' })
    expect(store.current()).toBe(KEY)
  })

  it('turns plain text encryption on before reading a plain text key', async () => {
    const content = await stored('basic_text')
    const { store, safeStorage } = storeWith('basic_text', fakeFile(content))
    const status = await store.load()
    expect(safeStorage.plainTextCalls).toEqual([true])
    expect(status).toMatchObject({ present: true, storage: 'plain-text' })
    expect(store.current()).toBe(KEY)
  })

  it('has no key when nothing is stored', async () => {
    const { store } = storeWith('gnome_libsecret')
    const status = await store.load()
    expect(status).toMatchObject({
      present: false,
      storage: 'none',
      unreadable: false,
    })
    expect(store.current()).toBeUndefined()
  })

  it('reports an unreadable key and leaves the file alone when the keyring is gone', async () => {
    const content = await stored('gnome_libsecret')
    const file = fakeFile(content)
    const { store } = storeWith('basic_text', file)
    const status = await store.load()
    expect(status).toMatchObject({ present: false, unreadable: true })
    expect(store.current()).toBeUndefined()
    expect(file.removals()).toBe(0)
    expect(file.content()).toBe(content)
  })

  it('reports an unreadable key for a corrupt file', async () => {
    const { store } = storeWith('gnome_libsecret', fakeFile('not json'))
    expect(await store.load()).toMatchObject({
      present: false,
      unreadable: true,
    })
  })

  it('reports an unreadable key when the file cannot be read', async () => {
    const store = createKeyStore({
      safeStorage: fakeSafeStorage('gnome_libsecret'),
      file: {
        ...fakeFile(),
        read: async () => {
          throw new Error('EACCES')
        },
      },
    })
    expect(await store.load()).toMatchObject({
      present: false,
      unreadable: true,
    })
  })

  it('reports an unreadable key for a file with the wrong shape', async () => {
    const { store } = storeWith(
      'gnome_libsecret',
      fakeFile('{"version":2,"storage":"keyring","data":"AAAA"}'),
    )
    expect(await store.load()).toMatchObject({ unreadable: true })
  })

  it('clears the unreadable flag once a new key is saved', async () => {
    const { store } = storeWith('gnome_libsecret', fakeFile('not json'))
    await store.load()
    const status = await store.save(KEY)
    expect(status).toMatchObject({ present: true, unreadable: false })
  })
})

describe('createKeyStore: clearing and status', () => {
  it('forgets the key and deletes the file', async () => {
    const { store, file } = storeWith('gnome_libsecret')
    await store.save(KEY)
    const status = await store.clear()
    expect(status).toMatchObject({ present: false, storage: 'none' })
    expect(store.current()).toBeUndefined()
    expect(file.content()).toBeNull()
  })

  it('never carries the key in its status', async () => {
    const { store } = storeWith('gnome_libsecret')
    const saved = await store.save(KEY)
    expect(JSON.stringify(saved)).not.toContain(KEY)
    expect(JSON.stringify(store.status())).not.toContain(KEY)
  })
})

describe('createKeyStore: keyringStored in the status', () => {
  const stored = async () => {
    const writer = storeWith('gnome_libsecret')
    await writer.store.save(KEY)
    return writer.file.content()
  }

  it('is false with nothing stored', async () => {
    const { store } = storeWith('gnome_libsecret')
    expect((await store.load()).keyringStored).toBe(false)
  })

  it('is true after a key is saved to the keyring', async () => {
    const { store } = storeWith('gnome_libsecret')
    expect((await store.save(KEY)).keyringStored).toBe(true)
  })

  it('is true when a keyring file cannot be read because the keyring is unavailable', async () => {
    const { store } = storeWith('basic_text', fakeFile(await stored()))
    expect(await store.load()).toMatchObject({
      present: false,
      unreadable: true,
      keyringStored: true,
    })
  })

  it('stays true when a session key is entered next to a kept keyring file', async () => {
    const { store } = storeWith('basic_text', fakeFile(await stored()))
    await store.load()
    expect(await store.save('sk-or-v1-second')).toMatchObject({
      storage: 'session',
      keyringStored: true,
    })
  })

  it('is false for a plain text file and after a plain text file is replaced by a session key', async () => {
    const plain = '{"version":1,"storage":"plain-text","data":"AAAA"}'
    const { store } = storeWith('basic_text', fakeFile(plain))
    expect((await store.load()).keyringStored).toBe(false)
    expect((await store.save(KEY)).keyringStored).toBe(false)
  })

  it('is false once Remove key has deleted the file', async () => {
    const { store } = storeWith('basic_text', fakeFile(await stored()))
    await store.load()
    expect((await store.clear()).keyringStored).toBe(false)
  })

  it('turns false when plain text replaces the keyring file', async () => {
    const { store } = storeWith('basic_text', fakeFile(await stored()))
    await store.load()
    await store.save('sk-or-v1-second')
    expect((await store.keepAsPlainText()).keyringStored).toBe(false)
  })
})
