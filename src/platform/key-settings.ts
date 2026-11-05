import type { ChiriApi } from '../../electron/api'
import type { PlatformKit } from './kit'

export const withKeySettings = async <Ref>(
  api: Pick<
    ChiriApi,
    'keyState' | 'saveKey' | 'keepKeyAsPlainText' | 'clearKey'
  >,
  kit: PlatformKit<Ref>,
): Promise<PlatformKit<Ref>> => {
  const state = await api.keyState()
  return state.managed
    ? {
        ...kit,
        keyStatus: { present: state.present },
        keySettings: {
          state,
          save: api.saveKey,
          keepAsPlainText: api.keepKeyAsPlainText,
          clear: api.clearKey,
        },
      }
    : kit
}
