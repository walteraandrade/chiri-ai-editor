import { describe, expect, it } from 'vitest'
import {
  createFakeFileSystem,
  deniedDirectory,
  deniedFile,
  emptyDirectory,
  link,
  special,
} from './fake-file-system'

const fileSystem = createFakeFileSystem({
  '/home/u/skills/pdf/SKILL.md': 'pdf text',
  '/home/u/skills/pdf/refs/a.md': 'a',
  '/home/u/skills/alias': link('/home/u/other/target'),
  '/home/u/skills/relative': link('pdf'),
  '/home/u/skills/up': link('../other/target'),
  '/home/u/skills/gone': link('/home/u/nowhere'),
  '/home/u/skills/loop-a': link('/home/u/skills/loop-b'),
  '/home/u/skills/loop-b': link('/home/u/skills/loop-a'),
  '/home/u/skills/secret.md': deniedFile,
  '/home/u/skills/vault': deniedDirectory,
  '/home/u/skills/empty': emptyDirectory,
  '/home/u/skills/socket': special,
  '/home/u/other/target/SKILL.md': 'target text',
})

const namesIn = async (path: string): Promise<readonly string[]> =>
  (await fileSystem.listDirectory(path)).map(({ name }) => name).sort()

describe('createFakeFileSystem', () => {
  it('lists entries with their kinds, links not followed', async () => {
    const entries = await fileSystem.listDirectory('/home/u/skills')
    const kinds = Object.fromEntries(entries.map((e) => [e.name, e.kind]))
    expect(kinds).toMatchObject({
      pdf: 'directory',
      alias: 'symlink',
      gone: 'symlink',
      'secret.md': 'file',
      empty: 'directory',
      socket: 'other',
    })
  })

  it('implies the directories above a file', async () => {
    expect(await namesIn('/home')).toEqual(['u'])
    expect(await namesIn('/home/u/skills/pdf')).toEqual(['SKILL.md', 'refs'])
  })

  it('lists an empty directory', async () => {
    expect(await namesIn('/home/u/skills/empty')).toEqual([])
  })

  it('resolves real paths through absolute and relative links', async () => {
    expect(await fileSystem.realPath('/home/u/skills/alias')).toBe(
      '/home/u/other/target',
    )
    expect(await fileSystem.realPath('/home/u/skills/relative')).toBe(
      '/home/u/skills/pdf',
    )
    expect(await fileSystem.realPath('/home/u/skills/up')).toBe(
      '/home/u/other/target',
    )
    expect(await fileSystem.realPath('/home/u/skills/alias/SKILL.md')).toBe(
      '/home/u/other/target/SKILL.md',
    )
    expect(await fileSystem.realPath('/home/u/skills/pdf')).toBe(
      '/home/u/skills/pdf',
    )
  })

  it('lists and reads through a link', async () => {
    expect(await namesIn('/home/u/skills/alias')).toEqual(['SKILL.md'])
    expect(await fileSystem.readText('/home/u/skills/alias/SKILL.md')).toBe(
      'target text',
    )
  })

  it('fails on a broken link, a loop and a missing path', async () => {
    await expect(fileSystem.realPath('/home/u/skills/gone')).rejects.toThrow()
    await expect(fileSystem.realPath('/home/u/skills/loop-a')).rejects.toThrow()
    await expect(fileSystem.listDirectory('/nope')).rejects.toThrow()
    await expect(fileSystem.readText('/nope')).rejects.toThrow()
  })

  it('fails to list a file and to read a directory', async () => {
    await expect(
      fileSystem.listDirectory('/home/u/skills/pdf/SKILL.md'),
    ).rejects.toThrow()
    await expect(fileSystem.readText('/home/u/skills/pdf')).rejects.toThrow()
  })

  it('fails to read a denied file and to list a denied directory', async () => {
    await expect(
      fileSystem.readText('/home/u/skills/secret.md'),
    ).rejects.toThrow('EACCES')
    await expect(
      fileSystem.listDirectory('/home/u/skills/vault'),
    ).rejects.toThrow('EACCES')
    expect(await fileSystem.realPath('/home/u/skills/secret.md')).toBe(
      '/home/u/skills/secret.md',
    )
  })
})
