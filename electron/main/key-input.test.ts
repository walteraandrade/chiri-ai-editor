import { describe, expect, it } from 'vitest'
import { parseKeyInput } from './key-input'

describe('parseKeyInput', () => {
  it('returns the key trimmed', () => {
    expect(parseKeyInput('  sk-or-v1-dummy-for-tests\n')).toBe(
      'sk-or-v1-dummy-for-tests',
    )
  })

  it('rejects anything that is not a string', () => {
    for (const value of [undefined, null, 1, {}, [], ['sk-or-v1-a']])
      expect(() => parseKeyInput(value)).toThrow('Invalid key')
  })

  it('rejects an empty key', () => {
    expect(() => parseKeyInput('')).toThrow('Invalid key')
    expect(() => parseKeyInput('   \n')).toThrow('Invalid key')
  })

  it('rejects whitespace, control and non-ASCII characters inside the key', () => {
    for (const value of [
      'sk or',
      'sk-or\nX-Injected: 1',
      'sk\r\nor',
      'sk-or\u0000',
      'sk-or-é',
      'sk-or-​',
    ])
      expect(() => parseKeyInput(value)).toThrow('Invalid key')
  })

  it('rejects a key over 512 characters and accepts one of 512', () => {
    expect(() => parseKeyInput('a'.repeat(513))).toThrow('Invalid key')
    expect(parseKeyInput('a'.repeat(512))).toBe('a'.repeat(512))
  })

  it('does not echo the rejected value in the error', () => {
    try {
      parseKeyInput('sk or secret')
    } catch (error) {
      expect(String(error)).not.toContain('secret')
    }
  })
})
