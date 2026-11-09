import { describe, expect, it } from 'vitest'
import {
  MODEL_CHANGED_EVENT,
  parseModelChoice,
  readModelChoice,
  writeModelChoice,
} from './model-choice'

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('parseModelChoice', () => {
  it('reads an OpenRouter model id', () => {
    expect(parseModelChoice(' openai/gpt-6.1-terra ')).toEqual({
      type: 'model',
      id: 'openai/gpt-6.1-terra',
    })
    expect(parseModelChoice('deepseek/deepseek-v4.1-flash:free')).toEqual({
      type: 'model',
      id: 'deepseek/deepseek-v4.1-flash:free',
    })
  })

  it('reads empty text as the default model', () => {
    expect(parseModelChoice('   ')).toEqual({ type: 'default' })
  })

  it('refuses text that is not a provider/model id', () => {
    expect(parseModelChoice('gpt')).toMatchObject({ type: 'invalid' })
    expect(parseModelChoice('a b/c')).toMatchObject({ type: 'invalid' })
    expect(parseModelChoice('https://x.y/z')).toMatchObject({ type: 'invalid' })
  })
})

describe('stored choice', () => {
  it('round-trips a model and clears it with undefined', () => {
    const storage = memory()
    writeModelChoice(storage, 'openai/gpt-6.1-terra')
    expect(readModelChoice(storage)).toBe('openai/gpt-6.1-terra')
    writeModelChoice(storage, undefined)
    expect(readModelChoice(storage)).toBeUndefined()
  })

  it('ignores a stored value that is not a model id', () => {
    expect(
      readModelChoice(memory({ 'desafinado.model': 'junk' })),
    ).toBeUndefined()
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readModelChoice(broken)).toBeUndefined()
    expect(() => writeModelChoice(broken, 'a/b')).not.toThrow()
  })

  it('names its change event', () => {
    expect(MODEL_CHANGED_EVENT).toBe('desafinado:model-changed')
  })
})
