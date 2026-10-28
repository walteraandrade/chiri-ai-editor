import { describe, expect, it } from 'vitest'
import { FALLBACK_MODEL, resolveModel } from './default-model'

describe('resolveModel', () => {
  it('uses the configured model', () => {
    expect(resolveModel(' vendor/model-a ')).toBe('vendor/model-a')
  })

  it('falls back when nothing is configured', () => {
    expect(resolveModel(undefined)).toBe(FALLBACK_MODEL)
    expect(resolveModel('')).toBe(FALLBACK_MODEL)
    expect(resolveModel('   ')).toBe(FALLBACK_MODEL)
  })
})
