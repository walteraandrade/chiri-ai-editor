import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type AtomicFs, writeAtomic } from './write-atomic'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chiri-atomic-'))
})

afterEach(async () => {
  await chmod(dir, 0o700).catch(() => undefined)
  await rm(dir, { recursive: true, force: true })
})

const modeOf = async (path: string): Promise<number> =>
  (await stat(path)).mode & 0o777

describe('writeAtomic', () => {
  it('replaces the text of an existing file', async () => {
    const target = join(dir, 'SKILL.md')
    await writeFile(target, 'old\n')
    await writeAtomic(target, 'new\n')
    expect(await readFile(target, 'utf8')).toBe('new\n')
  })

  it('leaves no temporary file behind', async () => {
    const target = join(dir, 'SKILL.md')
    await writeFile(target, 'old\n')
    await writeAtomic(target, 'new\n')
    expect(await readdir(dir)).toEqual(['SKILL.md'])
  })

  it.each([0o600, 0o640, 0o755])('keeps the file mode %o', async (mode) => {
    const target = join(dir, 'SKILL.md')
    await writeFile(target, 'old\n')
    await chmod(target, mode)
    await writeAtomic(target, 'new\n')
    expect(await modeOf(target)).toBe(mode)
  })

  it('gives the new file a new inode, so a reader never sees half a file', async () => {
    const target = join(dir, 'SKILL.md')
    await writeFile(target, 'old\n')
    const before = (await stat(target)).ino
    await writeAtomic(target, 'new\n')
    expect((await stat(target)).ino).not.toBe(before)
  })

  it('creates a file that does not exist yet, readable by others', async () => {
    const target = join(dir, 'fresh.md')
    await writeAtomic(target, 'hello\n')
    expect(await readFile(target, 'utf8')).toBe('hello\n')
    expect((await modeOf(target)) & 0o044).toBe(0o044)
  })

  it('writes text with multibyte characters as UTF-8', async () => {
    const target = join(dir, 'SKILL.md')
    await writeAtomic(target, 'açaí ☕\n')
    expect(await readFile(target)).toEqual(Buffer.from('açaí ☕\n', 'utf8'))
  })

  it('fails and removes the temporary file when the rename cannot happen', async () => {
    const target = join(dir, 'folder.md')
    await mkdir(target)
    await writeFile(join(target, 'inside'), 'x')
    await expect(writeAtomic(target, 'new\n')).rejects.toThrow()
    expect(await readdir(dir)).toEqual(['folder.md'])
  })

  it('fails and keeps the old text when the folder cannot be written', async () => {
    const target = join(dir, 'SKILL.md')
    await writeFile(target, 'old\n')
    await chmod(dir, 0o500)
    await expect(writeAtomic(target, 'new\n')).rejects.toThrow()
    await chmod(dir, 0o700)
    expect(await readFile(target, 'utf8')).toBe('old\n')
    expect(await readdir(dir)).toEqual(['SKILL.md'])
  })

  it('fails when the folder does not exist', async () => {
    await expect(
      writeAtomic(join(dir, 'missing', 'a.md'), 'x'),
    ).rejects.toThrow()
  })
})

const fakeFs = (
  log: string[],
  options: { readonly renameFails?: boolean } = {},
) => {
  const fs: AtomicFs = {
    stat: async () => {
      log.push('stat')
      return { mode: 0o100640 }
    },
    open: async () => {
      log.push('open')
      return {
        writeFile: async () => {
          log.push('write')
        },
        chmod: async () => {
          log.push('chmod')
        },
        sync: async () => {
          log.push('sync')
        },
        close: async () => {
          log.push('close')
        },
      }
    },
    rename: async () => {
      log.push('rename')
      if (options.renameFails) throw new Error('EXDEV')
    },
    unlink: async () => {
      log.push('unlink')
    },
  }
  return fs
}

describe('writeAtomic order', () => {
  it('writes and syncs the temporary file, then asks, then renames', async () => {
    const log: string[] = []
    const outcome = await writeAtomic(
      '/skills/a/SKILL.md',
      'new\n',
      async () => {
        log.push('accept')
        return true
      },
      fakeFs(log),
    )
    expect(outcome).toBe('written')
    expect(log).toEqual([
      'stat',
      'open',
      'write',
      'chmod',
      'sync',
      'close',
      'accept',
      'rename',
    ])
  })

  it('removes the temporary file and never renames when the answer is no', async () => {
    const log: string[] = []
    const outcome = await writeAtomic(
      '/skills/a/SKILL.md',
      'new\n',
      async () => {
        log.push('accept')
        return false
      },
      fakeFs(log),
    )
    expect(outcome).toBe('rejected')
    expect(log.slice(-2)).toEqual(['accept', 'unlink'])
    expect(log).not.toContain('rename')
  })

  it('removes the temporary file and lets the error through when asking fails', async () => {
    const log: string[] = []
    await expect(
      writeAtomic(
        '/skills/a/SKILL.md',
        'new\n',
        async () => {
          throw new Error('read failed')
        },
        fakeFs(log),
      ),
    ).rejects.toThrow('read failed')
    expect(log.slice(-1)).toEqual(['unlink'])
    expect(log).not.toContain('rename')
  })

  it('removes the temporary file when the rename fails', async () => {
    const log: string[] = []
    await expect(
      writeAtomic(
        '/skills/a/SKILL.md',
        'new\n',
        async () => true,
        fakeFs(log, { renameFails: true }),
      ),
    ).rejects.toThrow('EXDEV')
    expect(log.slice(-2)).toEqual(['rename', 'unlink'])
  })

  it('answers written without asking anything when no check is given', async () => {
    const log: string[] = []
    expect(
      await writeAtomic('/skills/a/SKILL.md', 'new\n', undefined, fakeFs(log)),
    ).toBe('written')
  })
})
