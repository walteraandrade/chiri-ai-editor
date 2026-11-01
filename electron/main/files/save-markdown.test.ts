import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES } from './limits'
import { saveMarkdown, saveMarkdownAs } from './save-markdown'

let dir = ''

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'chiri-save-')))
})

afterEach(async () => {
  await chmod(dir, 0o700).catch(() => undefined)
  await rm(dir, { recursive: true, force: true })
})

const modeOf = async (path: string): Promise<number> =>
  (await stat(path)).mode & 0o777

describe('saveMarkdown', () => {
  it('writes when the disk still holds the text last read', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    expect(
      await saveMarkdown({ path, text: '# A, edited\n', expected: '# A\n' }),
    ).toEqual({ kind: 'saved', path, name: 'SKILL.md' })
    expect(await readFile(path, 'utf8')).toBe('# A, edited\n')
  })

  it('never overwrites a file that changed after it was read', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A, changed by an agent\n')
    expect(
      await saveMarkdown({ path, text: '# A, mine\n', expected: '# A\n' }),
    ).toEqual({ kind: 'conflict' })
    expect(await readFile(path, 'utf8')).toBe('# A, changed by an agent\n')
    expect(await readdir(dir)).toEqual(['SKILL.md'])
  })

  it('treats a file that disappeared as a change', async () => {
    const path = join(dir, 'SKILL.md')
    expect(
      await saveMarkdown({ path, text: '# A\n', expected: '# A\n' }),
    ).toEqual({ kind: 'conflict' })
    expect(await readdir(dir)).toEqual([])
  })

  it('treats a file that stopped being text as a change', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x00]))
    expect(
      await saveMarkdown({ path, text: '# A\n', expected: '# A\n' }),
    ).toEqual({ kind: 'conflict' })
  })

  it('does not count CRLF as a change, and writes LF', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\r\n\r\nB\r\n')
    expect(
      await saveMarkdown({
        path,
        text: '# A\n\nB, edited\n',
        expected: '# A\n\nB\n',
      }),
    ).toMatchObject({ kind: 'saved' })
    expect(await readFile(path, 'utf8')).toBe('# A\n\nB, edited\n')
  })

  it('keeps the file mode', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    await chmod(path, 0o750)
    await saveMarkdown({ path, text: '# B\n', expected: '# A\n' })
    expect(await modeOf(path)).toBe(0o750)
  })

  it('keeps a symlink a symlink, writes the target and keeps its mode', async () => {
    const real = join(dir, 'agents', 'SKILL.md')
    await mkdir(join(dir, 'agents'))
    await writeFile(real, '# A\n')
    await chmod(real, 0o640)
    await mkdir(join(dir, 'claude'))
    const link = join(dir, 'claude', 'SKILL.md')
    await symlink(real, link)

    const result = await saveMarkdown({
      path: link,
      text: '# B\n',
      expected: '# A\n',
    })

    expect(result).toEqual({ kind: 'saved', path: real, name: 'SKILL.md' })
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readlink(link)).toBe(real)
    expect(await readFile(real, 'utf8')).toBe('# B\n')
    expect(await modeOf(real)).toBe(0o640)
    expect(await readdir(join(dir, 'claude'))).toEqual(['SKILL.md'])
    expect(await readdir(join(dir, 'agents'))).toEqual(['SKILL.md'])
  })

  it('keeps a symlinked skill folder in place', async () => {
    const folder = join(dir, 'agents', 'skill')
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'SKILL.md'), '# A\n')
    await mkdir(join(dir, 'claude'))
    const link = join(dir, 'claude', 'skill')
    await symlink(folder, link)
    await saveMarkdown({
      path: join(link, 'SKILL.md'),
      text: '# B\n',
      expected: '# A\n',
    })
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readFile(join(folder, 'SKILL.md'), 'utf8')).toBe('# B\n')
  })

  it('fails, with the old text intact, when the folder cannot be written', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    await chmod(dir, 0o500)
    const result = await saveMarkdown({
      path,
      text: '# B\n',
      expected: '# A\n',
    })
    await chmod(dir, 0o700)
    expect(result).toEqual({ kind: 'failed', reason: 'Permission denied' })
    expect(await readFile(path, 'utf8')).toBe('# A\n')
  })

  it('refuses a file that is not Markdown', async () => {
    const path = join(dir, 'run.sh')
    await writeFile(path, 'echo hi\n')
    expect(
      await saveMarkdown({ path, text: 'x', expected: 'echo hi\n' }),
    ).toEqual({ kind: 'failed', reason: 'Not a Markdown file' })
    expect(await readFile(path, 'utf8')).toBe('echo hi\n')
  })
})

describe('saveMarkdown, size', () => {
  it('refuses text whose UTF-8 bytes are over the limit, with a message', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    const text = 'あ'.repeat(2_000_000)
    expect(text.length).toBeLessThan(MAX_FILE_BYTES)
    expect(Buffer.byteLength(text, 'utf8')).toBeGreaterThan(MAX_FILE_BYTES)
    expect(await saveMarkdown({ path, text, expected: '# A\n' })).toEqual({
      kind: 'failed',
      reason: 'Too large to save (over 5 MiB)',
    })
    expect(await readFile(path, 'utf8')).toBe('# A\n')
    expect(await readdir(dir)).toEqual(['SKILL.md'])
  })

  it('accepts text of exactly the limit', async () => {
    const path = join(dir, 'SKILL.md')
    await writeFile(path, '# A\n')
    const text = 'a'.repeat(MAX_FILE_BYTES)
    expect(await saveMarkdown({ path, text, expected: '# A\n' })).toMatchObject(
      { kind: 'saved' },
    )
  })
})

describe('saveMarkdownAs', () => {
  it('refuses text over the byte limit before writing', async () => {
    const path = join(dir, 'big.md')
    expect(
      await saveMarkdownAs({ path, text: 'あ'.repeat(2_000_000) }),
    ).toEqual({ kind: 'failed', reason: 'Too large to save (over 5 MiB)' })
    expect(await readdir(dir)).toEqual([])
  })

  it('creates a new file', async () => {
    const path = join(dir, 'new.md')
    expect(await saveMarkdownAs({ path, text: '# New\n' })).toEqual({
      kind: 'saved',
      path,
      name: 'new.md',
    })
    expect(await readFile(path, 'utf8')).toBe('# New\n')
  })

  it('replaces an existing file the user chose, keeping its mode', async () => {
    const path = join(dir, 'old.md')
    await writeFile(path, 'old\n')
    await chmod(path, 0o600)
    await saveMarkdownAs({ path, text: '# New\n' })
    expect(await readFile(path, 'utf8')).toBe('# New\n')
    expect(await modeOf(path)).toBe(0o600)
  })

  it('writes through a symlink and keeps it', async () => {
    const real = join(dir, 'real.md')
    await writeFile(real, 'old\n')
    const link = join(dir, 'link.md')
    await symlink(real, link)
    expect(await saveMarkdownAs({ path: link, text: '# New\n' })).toEqual({
      kind: 'saved',
      path: real,
      name: 'real.md',
    })
    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readFile(real, 'utf8')).toBe('# New\n')
  })

  it('fails when the folder does not exist', async () => {
    expect(
      await saveMarkdownAs({ path: join(dir, 'missing', 'a.md'), text: 'x' }),
    ).toEqual({ kind: 'failed', reason: 'File not found' })
  })

  it('refuses a name that is not Markdown', async () => {
    expect(
      await saveMarkdownAs({ path: join(dir, 'notes.txt'), text: 'x' }),
    ).toEqual({ kind: 'failed', reason: 'Not a Markdown file' })
    expect(await readdir(dir)).toEqual([])
  })
})
