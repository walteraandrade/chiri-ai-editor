import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  countSecretOccurrences,
  isTextFile,
  MASK,
  maskBytes,
  maskSecrets,
  residualKeyCount,
} from './session-masking'

const fakeKey = () => `sk-or-v1-${randomBytes(32).toString('hex')}`

describe('maskSecrets', () => {
  it('replaces a full key with the mask', () => {
    const result = maskSecrets(fakeKey())

    expect(result).toEqual({ text: MASK, spans: 1 })
  })

  it('keeps everything around the key', () => {
    const line = (key: string) => `{"text":"use ${key} now","n":1}`

    const result = maskSecrets(line(fakeKey()))

    expect(result).toEqual({ text: line(MASK), spans: 1 })
  })

  it('counts several keys', () => {
    const text = `${fakeKey()} and ${fakeKey()}\n${fakeKey()}`

    const result = maskSecrets(text)

    expect(result).toEqual({ text: `${MASK} and ${MASK}\n${MASK}`, spans: 3 })
  })

  it('catches a partially masked label', () => {
    const result = maskSecrets('key sk-or-v1-abc...xyz is shown')

    expect(result).toEqual({ text: `key ${MASK} is shown`, spans: 1 })
  })

  it('catches a key made of letters and digits only', () => {
    const result = maskSecrets('sk-or-ABCdef0123')

    expect(result).toEqual({ text: MASK, spans: 1 })
  })

  it.each([
    'sk-or-***MASKED***',
    '"sk-or-"',
    'sk-or-…',
    'sk-or-',
    'ask-or',
    'sk-ant-api03-abc',
  ])('leaves %s alone', (text) => {
    expect(maskSecrets(text)).toEqual({ text, spans: 0 })
  })

  it('does not swallow the punctuation after a key', () => {
    const key = fakeKey()

    const result = maskSecrets(`The key is ${key}. Next, "${key}", ${key}...`)

    expect(result).toEqual({
      text: `The key is ${MASK}. Next, "${MASK}", ${MASK}...`,
      spans: 3,
    })
  })

  it('stops at JSON escapes', () => {
    const key = fakeKey()

    const result = maskSecrets(`"a ${key}\\nb ${key}\\u2026"`)

    expect(result).toEqual({
      text: `"a ${MASK}\\nb ${MASK}\\u2026"`,
      spans: 2,
    })
  })

  it('is idempotent', () => {
    const once = maskSecrets(`x ${fakeKey()} y`)

    expect(maskSecrets(once.text)).toEqual({ text: once.text, spans: 0 })
  })

  it('masks the exact value of a secret even without the prefix', () => {
    const secret = 'plain-secret-value-123'

    const result = maskSecrets(`a ${secret} b ${secret}`, [secret])

    expect(result).toEqual({ text: `a ${MASK} b ${MASK}`, spans: 2 })
  })

  it('counts exact secrets and pattern keys together', () => {
    const secret = 'plain-secret-value-123'
    const key = fakeKey()

    const result = maskSecrets(`${secret} ${key}`, [secret])

    expect(result).toEqual({ text: `${MASK} ${MASK}`, spans: 2 })
  })

  it('masks the longer secret first when one contains the other', () => {
    const result = maskSecrets('token-abcdef12-extra', [
      'token-abcdef12',
      'token-abcdef12-extra',
    ])

    expect(result).toEqual({ text: MASK, spans: 1 })
  })

  it('ignores empty and very short secrets', () => {
    expect(maskSecrets('a b c abc', ['', ' ', 'a', 'abc'])).toEqual({
      text: 'a b c abc',
      spans: 0,
    })
  })
})

describe('residualKeyCount', () => {
  it('counts keys but not the mask', () => {
    const text = `${MASK} ${fakeKey()} sk-or-abc "sk-or-" sk-or-…`

    expect(residualKeyCount(text)).toBe(2)
  })

  it('is zero after masking', () => {
    const { text } = maskSecrets(`a ${fakeKey()} b sk-or-v1-abc...xyz`)

    expect(residualKeyCount(text)).toBe(0)
  })
})

describe('maskBytes', () => {
  it('leaves bytes outside the masked spans untouched, even invalid UTF-8', () => {
    const before = Buffer.from([0xff, 0xfe, 0xc3, 0x28, 0x0a])
    const after = Buffer.from([0x80, 0x81, 0xe2, 0x82])
    const key = fakeKey()
    const source = Buffer.concat([before, Buffer.from(key), after])

    const result = maskBytes(source)

    expect(result.spans).toBe(1)
    expect(
      result.bytes.equals(Buffer.concat([before, Buffer.from(MASK), after])),
    ).toBe(true)
  })

  it('keeps multibyte characters byte for byte', () => {
    const text = `ação — 日本語 😀 ${fakeKey()} ç`

    const result = maskBytes(Buffer.from(text, 'utf8'))

    expect(result.bytes.toString('utf8')).toBe(`ação — 日本語 😀 ${MASK} ç`)
  })

  it('masks a secret with non-ASCII characters', () => {
    const secret = 'segredo-çãõ-12345'

    const result = maskBytes(Buffer.from(`a ${secret} b`, 'utf8'), [secret])

    expect(result.bytes.toString('utf8')).toBe(`a ${MASK} b`)
    expect(result.spans).toBe(1)
  })
})

describe('isTextFile', () => {
  it.each(['a.jsonl', 'a.json', 'a.txt', 'a.md', 'tool-results/abc'])(
    'treats %s as text',
    (path) => {
      expect(isTextFile(path, Buffer.from('hello'))).toBe(true)
    },
  )

  it.each(['a.png', 'a.jpg', 'a.JPEG', 'a.gif', 'a.webp', 'a.pdf', 'a.zip'])(
    'treats %s as binary',
    (path) => {
      expect(isTextFile(path, Buffer.from('hello'))).toBe(false)
    },
  )

  it('treats content with a NUL byte as binary', () => {
    expect(isTextFile('a.txt', Buffer.from([0x68, 0x00, 0x69]))).toBe(false)
  })
})

describe('countSecretOccurrences', () => {
  it('counts every occurrence of every usable secret', () => {
    const bytes = Buffer.from('one-secret-aa two-secret-bb one-secret-aa')

    expect(
      countSecretOccurrences(bytes, ['one-secret-aa', 'two-secret-bb']),
    ).toBe(3)
  })

  it('counts non-ASCII secrets by their UTF-8 bytes', () => {
    const bytes = Buffer.from('x segredo-çãõ-12345 y', 'utf8')

    expect(countSecretOccurrences(bytes, ['segredo-çãõ-12345'])).toBe(1)
  })

  it('ignores short secrets and finds nothing in clean bytes', () => {
    expect(countSecretOccurrences(Buffer.from('abc'), ['abc', ''])).toBe(0)
    expect(
      countSecretOccurrences(Buffer.from('clean'), ['other-secret-1']),
    ).toBe(0)
  })
})
