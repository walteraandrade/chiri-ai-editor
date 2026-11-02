import { describe, expect, it } from 'vitest'
import type { KeyState } from '../../electron/api'
import {
  describeKeyState,
  offersPlainText,
  removeNote,
  saveErrorMessage,
} from './key-status'

const state = (overrides: Partial<KeyState> = {}): KeyState => ({
  managed: true,
  present: false,
  storage: 'none',
  keyringAvailable: true,
  keyringStored: false,
  backend: 'gnome_libsecret',
  unreadable: false,
  ...overrides,
})

describe('describeKeyState', () => {
  it('says there is no key', () => {
    expect(describeKeyState(state())).toBe('No key set.')
  })

  it('says where a stored key lives', () => {
    expect(describeKeyState(state({ present: true, storage: 'keyring' }))).toBe(
      'Stored in the system keyring (gnome_libsecret).',
    )
    expect(
      describeKeyState(
        state({ present: true, storage: 'keyring', backend: 'kwallet6' }),
      ),
    ).toBe('Stored in the system keyring (kwallet6).')
  })

  it('warns about plain text storage', () => {
    expect(
      describeKeyState(state({ present: true, storage: 'plain-text' })),
    ).toBe('Stored as plain text on this machine, like .env.')
  })

  it('says a session key is forgotten on quit', () => {
    expect(describeKeyState(state({ present: true, storage: 'session' }))).toBe(
      'Kept for this session only. Quitting forgets it.',
    )
  })

  it('asks for the key again when the stored one cannot be read', () => {
    expect(describeKeyState(state({ unreadable: true }))).toBe(
      'The stored key could not be read. Enter it again.',
    )
  })

  it('blames the keyring when the stored one cannot be read and the keyring is not available', () => {
    expect(
      describeKeyState(state({ unreadable: true, keyringAvailable: false })),
    ).toBe(
      'The system keyring is not available, so the stored key cannot be read. Unlock your keyring and restart Chiri.',
    )
  })
})

describe('offersPlainText', () => {
  it('offers it only for a session key with no working keyring', () => {
    expect(
      offersPlainText(
        state({ present: true, storage: 'session', keyringAvailable: false }),
      ),
    ).toBe(true)
  })

  it('does not offer it in any other state', () => {
    expect(offersPlainText(state())).toBe(false)
    expect(offersPlainText(state({ present: true, storage: 'keyring' }))).toBe(
      false,
    )
    expect(
      offersPlainText(state({ present: true, storage: 'plain-text' })),
    ).toBe(false)
    expect(
      offersPlainText(
        state({ present: true, storage: 'session', keyringAvailable: true }),
      ),
    ).toBe(false)
  })
})

describe('saveErrorMessage', () => {
  it('names an invalid key', () => {
    expect(
      saveErrorMessage(
        new Error(
          "Error invoking remote method 'key:save': Error: Invalid key",
        ),
      ),
    ).toBe('That does not look like a key. Paste it again.')
  })

  it('does not echo anything else', () => {
    expect(saveErrorMessage(new Error('boom sk-or-v1-secret'))).toBe(
      'Could not save the key.',
    )
    expect(saveErrorMessage('x')).toBe('Could not save the key.')
  })
})

describe('removeNote', () => {
  const NOTE = 'Remove key also deletes the key stored in your keyring.'

  it('warns when a keyring key sits behind a session key', () => {
    expect(
      removeNote(
        state({
          present: true,
          storage: 'session',
          keyringAvailable: false,
          keyringStored: true,
        }),
      ),
    ).toBe(NOTE)
  })

  it('warns when a keyring key cannot be read', () => {
    expect(
      removeNote(
        state({
          unreadable: true,
          keyringAvailable: false,
          keyringStored: true,
        }),
      ),
    ).toBe(NOTE)
  })

  it('says nothing when the key shown is the keyring key', () => {
    expect(
      removeNote(
        state({ present: true, storage: 'keyring', keyringStored: true }),
      ),
    ).toBeNull()
  })

  it('says nothing when no keyring key is stored', () => {
    expect(removeNote(state())).toBeNull()
    expect(removeNote(state({ present: true, storage: 'session' }))).toBeNull()
    expect(
      removeNote(state({ present: true, storage: 'plain-text' })),
    ).toBeNull()
  })
})
