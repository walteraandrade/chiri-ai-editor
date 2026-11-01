const MAX_KEY_LENGTH = 512
const VISIBLE_ASCII = /^[\x21-\x7e]+$/

export const parseKeyInput = (value: unknown): string => {
  const key = typeof value === 'string' ? value.trim() : ''
  if (
    key.length === 0 ||
    key.length > MAX_KEY_LENGTH ||
    !VISIBLE_ASCII.test(key)
  )
    throw new Error('Invalid key')
  return key
}
