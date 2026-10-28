import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { reviewEditSchema, suggestionSchema } from './schemas'

const strictObjectShape = (schema: z.ZodType, keys: readonly string[]) => {
  const json = z.toJSONSchema(schema) as {
    type?: string
    properties?: Record<string, { type?: string }>
    required?: string[]
    additionalProperties?: boolean
  }
  expect(json.type).toBe('object')
  expect(Object.keys(json.properties ?? {}).sort()).toEqual([...keys].sort())
  expect([...(json.required ?? [])].sort()).toEqual([...keys].sort())
  expect(json.additionalProperties).toBe(false)
  for (const key of keys) {
    expect(json.properties?.[key]?.type).toBe('string')
  }
}

describe('suggestionSchema', () => {
  it('accepts a replacement with a rationale', () => {
    expect(
      suggestionSchema.safeParse({ replacement: 'Hi', rationale: 'Shorter.' })
        .success,
    ).toBe(true)
  })

  it('rejects a missing rationale', () => {
    expect(suggestionSchema.safeParse({ replacement: 'Hi' }).success).toBe(
      false,
    )
  })

  it('rejects a non-string replacement', () => {
    expect(
      suggestionSchema.safeParse({ replacement: 1, rationale: 'x' }).success,
    ).toBe(false)
  })

  it('produces a strict-compatible JSON Schema', () => {
    strictObjectShape(suggestionSchema, ['replacement', 'rationale'])
  })
})

describe('reviewEditSchema', () => {
  it('accepts a complete edit', () => {
    expect(
      reviewEditSchema.safeParse({
        blockId: 'p3',
        replacement: 'New',
        rationale: 'Clearer.',
      }).success,
    ).toBe(true)
  })

  it('rejects an edit without a blockId', () => {
    expect(
      reviewEditSchema.safeParse({ replacement: 'New', rationale: 'x' })
        .success,
    ).toBe(false)
  })

  it('produces a strict-compatible JSON Schema', () => {
    strictObjectShape(reviewEditSchema, ['blockId', 'replacement', 'rationale'])
  })
})

describe('language anchors', () => {
  const descriptionOf = (schema: z.ZodType, key: string): string => {
    const json = z.toJSONSchema(schema) as {
      properties?: Record<string, { description?: string }>
    }
    return json.properties?.[key]?.description ?? ''
  }

  it('puts the Replacement in the Target language and the Rationale in the Document language', () => {
    expect(descriptionOf(suggestionSchema, 'replacement')).toMatch(
      /language of the Target/,
    )
    expect(descriptionOf(suggestionSchema, 'rationale')).toMatch(
      /language of the Document/,
    )
    expect(descriptionOf(reviewEditSchema, 'replacement')).toMatch(
      /language of that Block/,
    )
    expect(descriptionOf(reviewEditSchema, 'rationale')).toMatch(
      /language of the Document/,
    )
  })
})
