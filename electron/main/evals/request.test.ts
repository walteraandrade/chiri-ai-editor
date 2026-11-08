import { describe, expect, it } from 'vitest'
import {
  parseCancelRequest,
  parseOpenReportRequest,
  parseRunRequest,
  parseSkillRequest,
} from './request'

const valid = {
  skillPath: '/home/u/.claude/skills/pdf',
  baseline: { kind: 'none' },
  runs: 3,
  model: 'haiku',
  maxCostUsd: 0.5,
}

describe('parseRunRequest', () => {
  it('accepts a valid request', () => {
    expect(parseRunRequest(valid)).toEqual(valid)
  })

  it('accepts a Version baseline by id', () => {
    const request = { ...valid, baseline: { kind: 'version', versionId: 12 } }
    expect(parseRunRequest(request)).toEqual(request)
  })

  it.each([
    ['an extra field', { ...valid, flags: ['--allow-tools'] }],
    ['no baseline', { ...valid, baseline: undefined }],
    [
      'a baseline with text',
      { ...valid, baseline: { kind: 'version', versionId: 1, text: 'x' } },
    ],
    [
      'a baseline with a path',
      { ...valid, baseline: { kind: 'none', path: '/etc' } },
    ],
    ['a Version without id', { ...valid, baseline: { kind: 'version' } }],
    ['Version id 0', { ...valid, baseline: { kind: 'version', versionId: 0 } }],
    [
      'fractional Version id',
      { ...valid, baseline: { kind: 'version', versionId: 1.5 } },
    ],
    [
      'Version id as text',
      { ...valid, baseline: { kind: 'version', versionId: '1' } },
    ],
    ['another baseline kind', { ...valid, baseline: { kind: 'file' } }],
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

describe('parseOpenReportRequest', () => {
  const skillPath = '/home/u/.claude/skills/pdf'

  it('accepts a path alone or with a side', () => {
    expect(parseOpenReportRequest({ skillPath })).toEqual({ skillPath })
    expect(parseOpenReportRequest({ skillPath, part: 'version' })).toEqual({
      skillPath,
      part: 'version',
    })
  })

  it.each([
    ['another side', { skillPath, part: 'both' }],
    ['a path as side', { skillPath, part: '../x' }],
    ['an extra field', { skillPath, file: '/etc/passwd' }],
    ['no path', { part: 'today' }],
  ])('refuses %s', (_name, input) => {
    expect(parseOpenReportRequest(input)).toBeNull()
  })
})
