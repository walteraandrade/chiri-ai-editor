import type { KeyState } from '../../electron/api'

export const describeKeyState = (state: KeyState): string => {
  switch (state.storage) {
    case 'keyring':
      return `Stored in the system keyring (${state.backend}).`
    case 'plain-text':
      return 'Stored as plain text on this machine, like .env.'
    case 'session':
      return 'Kept for this session only. Quitting forgets it.'
    case 'none':
      return !state.unreadable
        ? 'No key set.'
        : state.keyringAvailable
          ? 'The stored key could not be read. Enter it again.'
          : 'The system keyring is not available, so the stored key cannot be read. Unlock your keyring and restart Chiri.'
  }
}

export const offersPlainText = (state: KeyState): boolean =>
  state.present && state.storage === 'session' && !state.keyringAvailable

export const saveErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.endsWith('Invalid key')
    ? 'That does not look like a key. Paste it again.'
    : 'Could not save the key.'
