export const MODEL_CHANGED_EVENT = 'desafinado:model-changed'

const STORAGE_KEY = 'desafinado.model'
const MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i

type ModelStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ModelChoice =
  | { readonly type: 'default' }
  | { readonly type: 'model'; readonly id: string }
  | { readonly type: 'invalid'; readonly message: string }

export const parseModelChoice = (text: string): ModelChoice => {
  const id = text.trim()
  if (id === '') return { type: 'default' }
  return MODEL_ID.test(id)
    ? { type: 'model', id }
    : {
        type: 'invalid',
        message: 'Use an OpenRouter id such as provider/model.',
      }
}

export const readModelChoice = (storage: ModelStorage): string | undefined => {
  try {
    const stored = storage.getItem(STORAGE_KEY)
    return stored !== null && MODEL_ID.test(stored) ? stored : undefined
  } catch {
    return undefined
  }
}

export const writeModelChoice = (
  storage: ModelStorage,
  id: string | undefined,
): void => {
  try {
    if (id === undefined) storage.removeItem(STORAGE_KEY)
    else storage.setItem(STORAGE_KEY, id)
  } catch {
    return
  }
}
