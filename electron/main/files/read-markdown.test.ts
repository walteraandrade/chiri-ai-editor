import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readMarkdown } from './read-markdown'

let dir = ''

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'desafinado-read-')))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const BOM = String.fromCharCode(0xfeff)

describe('readMarkdown', () => {
  it('returns the real path, the name and the text', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# Skill\n')
    expect(await readMarkdown(path)).toEqual({
      kind: 'opened',
      path,
      name: 'SKILL.md',
      text: '# Skill\n',
    })
  })

  it('decodes like the editor: no byte order mark, LF line endings', async () => {
    const path = join(dir, 'a.md')
    await writeFile(path, `${BOM}# A\r\n\r\nB\r\n`)
    expect(await readMarkdown(path)).toMatchObject({ text: '# A\n\nB\n' })
  })

  it('resolves a symlink to the file it points at', async () => {
    const real = join(dir, 'shared', 'SKILL.md')
    await mkdir(join(dir, 'shared'))
    await writeFile(real, '# Shared\n')
    await mkdir(join(dir, 'skills'))
    const link = join(dir, 'skills', 'linked')
    await symlink(join(dir, 'shared'), link)
    expect(await readMarkdown(join(link, 'SKILL.md'))).toMatchObject({
      kind: 'opened',
      path: real,
      name: 'SKILL.md',
    })
  })

  it('resolves a symlinked file whose name differs from its target', async () => {
    const real = join(dir, 'guide.md')
    await writeFile(real, '# Guide\n')
    const link = join(dir, 'SKILL.md')
    await symlink(real, link)
    expect(await readMarkdown(link)).toMatchObject({
      path: real,
      name: 'guide.md',
    })
  })

  it('says when the file is missing', async () => {
    expect(await readMarkdown(join(dir, 'missing.md'))).toEqual({
      kind: 'failed',
      reason: 'File not found',
    })
  })

  it('refuses a symlink that points at a file that is not Markdown', async () => {
    const real = join(dir, 'notes.txt')
    await writeFile(real, 'plain')
    const link = join(dir, 'SKILL.md')
    await symlink(real, link)
    expect(await readMarkdown(link)).toEqual({
      kind: 'failed',
      reason: 'Not a Markdown file',
    })
  })

  it('refuses a folder', async () => {
    const path = join(dir, 'folder.md')
    await mkdir(path)
    expect(await readMarkdown(path)).toEqual({
      kind: 'failed',
      reason: 'Not a file',
    })
  })

  it('refuses a file over the size limit', async () => {
    const path = join(dir, 'big.md')
    await writeFile(path, 'x'.repeat(101))
    expect(await readMarkdown(path, 100)).toEqual({
      kind: 'failed',
      reason: 'File is too large',
    })
  })

  it('refuses bytes that are not UTF-8 instead of replacing them', async () => {
    const path = join(dir, 'binary.md')
    await writeFile(path, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]))
    expect(await readMarkdown(path)).toEqual({
      kind: 'failed',
      reason: 'Not valid UTF-8 text',
    })
  })
})
