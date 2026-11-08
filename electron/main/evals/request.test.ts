import { describe, expect, it } from 'vitest'
import {
  parseCancelRequest,
  parseRunRequest,
  parseSkillRequest,
} from './request'

const valid = {
  skillPath: '/home/u/.claude/skills/pdf',
  runs: 3,
  model: 'haiku',
  maxCostUsd: 0.5,
}

describe('parseRunRequest', () => {
  it('accepts a valid request', () => {
    expect(parseRunRequest(valid)).toEqual(valid)
  })

  it.each([
    ['an extra field', { ...valid, flags: ['--allow-tools'] }],
    ['a missing field', { skillPath: valid.skillPath, runs: 1, model: 'x' }],
    ['a relative path', { ...valid, skillPath: 'skills/pdf' }],
    ['a path with NUL', { ...valid, skillPath: '/a\0b' }],
    ['runs 0', { ...valid, runs: 0 }],
    ['runs 6', { ...valid, runs: 6 }],
    ['fractional runs', { ...valid, runs: 1.5 }],
    ['runs as text', { ...valid, runs: '2' }],
    ['a flag as model', { ...valid, model: '--allow-tools' }],
    ['a model with =', { ...valid, model: 'a=b' }],
    ['cost 0', { ...valid, maxCostUsd: 0 }],
    ['cost above 5', { ...valid, maxCostUsd: 5.5 }],
    ['cost as text', { ...valid, maxCostUsd: '1' }],
    ['null', null],
    ['text', 'hello'],
  ])('refuses %s', (_name, input) => {
    expect(parseRunRequest(input)).toBeNull()
  })
})

describe('parseSkillRequest', () => {
  it('accepts only a path', () => {
    expect(parseSkillRequest({ skillPath: valid.skillPath })).toEqual({
      skillPath: valid.skillPath,
    })
    expect(parseSkillRequest(valid)).toBeNull()
    expect(parseSkillRequest({ skillPath: 'x' })).toBeNull()
  })
})

describe('parseCancelRequest', () => {
  it('accepts no argument or an empty object', () => {
    expect(parseCancelRequest(undefined)).toBe(true)
    expect(parseCancelRequest({})).toBe(true)
  })

  it.each([
    ['a path', { skillPath: '/a' }],
    ['text', 'now'],
    ['null', null],
  ])('refuses %s', (_name, input) => {
    expect(parseCancelRequest(input)).toBeNull()
  })
})
