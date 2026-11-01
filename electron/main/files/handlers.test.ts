import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openFile,
  readFileRequest,
  saveFileAsRequest,
  saveFileRequest,
} from './handlers'

let dir = ''

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'chiri-handlers-')))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const INVALID = { kind: 'failed', reason: 'Invalid request' }

describe('openFile', () => {
  it('reads the file the dialog returns', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    expect(await openFile(async () => path)).toEqual({
      kind: 'opened',
      path,
      name: 'SKILL.md',
      text: '# A\n',
    })
  })

  it('is cancelled when the dialog is', async () => {
    expect(await openFile(async () => null)).toEqual({ kind: 'cancelled' })
  })
})

describe('readFileRequest', () => {
  it('reads an absolute path', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    expect(await readFileRequest(path)).toMatchObject({ kind: 'opened' })
  })

  it.each([
    ['a relative path', 'SKILL.md'],
    ['a non-string', { path: '/x.md' }],
    ['nothing', undefined],
  ])('refuses %s without touching the disk', async (_label, input) => {
    expect(await readFileRequest(input)).toEqual(INVALID)
  })
})

describe('saveFileRequest', () => {
  it('saves when the disk still holds the expected text', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    expect(
      await saveFileRequest({ path, text: '# B\n', expected: '# A\n' }),
    ).toEqual({ kind: 'saved', path, name: 'SKILL.md' })
    expect(await readFile(path, 'utf8')).toBe('# B\n')
  })

  it('returns the conflict as a value', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# elsewhere\n')
    expect(
      await saveFileRequest({ path, text: '# B\n', expected: '# A\n' }),
    ).toEqual({ kind: 'conflict' })
  })

  it.each([
    ['a missing expected text', { path: '/x/SKILL.md', text: 'x' }],
    ['an extra field', { path: '/x/SKILL.md', text: 'x', expected: 'x', a: 1 }],
    ['a relative path', { path: 'SKILL.md', text: 'x', expected: 'x' }],
    ['a string', '/x/SKILL.md'],
  ])('refuses %s', async (_label, input) => {
    expect(await saveFileRequest(input)).toEqual(INVALID)
  })
})

describe('saveFileAsRequest', () => {
  it('asks for a place with the suggested name and writes there', async () => {
    const pick = vi.fn(async () => join(dir, 'copy.md'))
    const result = await saveFileAsRequest(
      { text: '# A\n', suggestedName: 'a.md' },
      pick,
    )
    expect(pick).toHaveBeenCalledWith('a.md')
    expect(result).toEqual({
      kind: 'saved',
      path: join(dir, 'copy.md'),
      name: 'copy.md',
    })
    expect(await readFile(join(dir, 'copy.md'), 'utf8')).toBe('# A\n')
  })

  it('adds .md when the dialog returns a name without it', async () => {
    const result = await saveFileAsRequest(
      { text: '# A\n', suggestedName: 'a.md' },
      async () => join(dir, 'notes'),
    )
    expect(result).toMatchObject({ kind: 'saved', name: 'notes.md' })
    expect(await readFile(join(dir, 'notes.md'), 'utf8')).toBe('# A\n')
  })

  it('is cancelled when the dialog is, and writes nothing', async () => {
    expect(
      await saveFileAsRequest(
        { text: '# A\n', suggestedName: 'a.md' },
        async () => null,
      ),
    ).toEqual({ kind: 'cancelled' })
  })

  it('refuses an invalid request before opening a dialog', async () => {
    const pick = vi.fn(async () => join(dir, 'x.md'))
    expect(
      await saveFileAsRequest({ text: 3, suggestedName: 'a.md' }, pick),
    ).toEqual(INVALID)
    expect(pick).not.toHaveBeenCalled()
  })
})
