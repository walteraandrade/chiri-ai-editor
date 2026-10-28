import { randomBytes } from 'node:crypto'
import {
  appendFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  exportSessions,
  listSessionFiles,
  type SessionFile,
  swapInto,
  verifyExport,
} from './session-export'
import { MASK } from './session-masking'

const PREFIX = '-home-test-app'
const PROJECT = `${PREFIX}--worktrees-one`
const OTHER_PROJECT = `${PREFIX}`
const UNRELATED_PROJECT = '-home-test-other'

const fakeKey = () => `sk-or-v1-${randomBytes(32).toString('hex')}`
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x73, 0x6b])

let root: string
let sourceRoot: string
let dest: string

const put = async (
  base: string,
  files: Readonly<Record<string, string | Buffer>>,
): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await mkdir(dirname(join(base, path)), { recursive: true })
      await writeFile(join(base, path), content)
    }),
  )
}

const listTree = async (base: string): Promise<readonly string[]> =>
  (await readdir(base, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(base.length + 1))
    .sort()

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  )

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'export-sessions-test-'))
  sourceRoot = join(root, 'projects')
  dest = join(root, 'out', 'ai-sessions')
  await mkdir(sourceRoot, { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const sessionFixture = (key: string): Record<string, string | Buffer> => ({
  [`${PROJECT}/s1.jsonl`]: `{"a":"hello ${key}"}\n{"b":2}\n`,
  [`${PROJECT}/s1/subagents/agent-1.jsonl`]: `{"c":"${key}","d":"${key}"}\n`,
  [`${PROJECT}/s1/tool-results/out.txt`]: 'plain output\n',
  [`${PROJECT}/s1/tool-results/data.json`]: `{"k":"${key}"}`,
  [`${PROJECT}/s1/tool-results/shot.png`]: PNG,
  [`${PROJECT}/s1/custom-title.json`]: '{"title":"x"}',
  [`${PROJECT}/s2.jsonl`]: '{"only":"line"}\n',
  [`${OTHER_PROJECT}/s3.jsonl`]: '{"z":1}\n',
  [`${OTHER_PROJECT}/s3/subagents/agent-9.jsonl`]: '{"y":1}\n',
})

const noiseFixture: Record<string, string | Buffer> = {
  [`${PROJECT}/memory/MEMORY.md`]: 'notes',
  [`${PROJECT}/s1.desktop-released.json`]: '{}',
  [`${PROJECT}/orphan/subagents/agent-2.jsonl`]: '{"orphan":true}\n',
  [`${PROJECT}/stray.txt`]: 'stray',
  [`${UNRELATED_PROJECT}/s9.jsonl`]: '{"secret":"no"}\n',
  [`${UNRELATED_PROJECT}/s9/subagents/a.jsonl`]: '{}\n',
}

const paths = (files: readonly SessionFile[]) =>
  files.map((file) => `${file.project}/${file.path}`)

describe('listSessionFiles', () => {
  it('selects every session file and its sibling folder content', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))

    const files = await listSessionFiles(sourceRoot, PREFIX)

    expect(paths(files)).toEqual([
      `${OTHER_PROJECT}/s3.jsonl`,
      `${OTHER_PROJECT}/s3/subagents/agent-9.jsonl`,
      `${PROJECT}/s1.jsonl`,
      `${PROJECT}/s1/custom-title.json`,
      `${PROJECT}/s1/subagents/agent-1.jsonl`,
      `${PROJECT}/s1/tool-results/data.json`,
      `${PROJECT}/s1/tool-results/out.txt`,
      `${PROJECT}/s1/tool-results/shot.png`,
      `${PROJECT}/s2.jsonl`,
    ])
  })

  it('skips memory, released markers, orphan folders, stray files and other projects', async () => {
    await put(sourceRoot, { ...sessionFixture(fakeKey()), ...noiseFixture })

    const selected = paths(await listSessionFiles(sourceRoot, PREFIX))

    expect(selected.filter((path) => path.includes('memory'))).toEqual([])
    expect(
      selected.filter((path) => path.includes('desktop-released')),
    ).toEqual([])
    expect(selected.filter((path) => path.includes('orphan'))).toEqual([])
    expect(selected.filter((path) => path.includes('stray'))).toEqual([])
    expect(selected.filter((path) => path.includes(UNRELATED_PROJECT))).toEqual(
      [],
    )
    expect(selected).toHaveLength(9)
  })

  it('returns nothing when no project matches', async () => {
    await put(sourceRoot, noiseFixture)

    expect(await listSessionFiles(sourceRoot, '-home-nobody')).toEqual([])
  })

  it('fails with a clear error when the source root is missing', async () => {
    await expect(
      listSessionFiles(join(root, 'missing'), PREFIX),
    ).rejects.toThrow(/source/i)
  })
})

describe('exportSessions', () => {
  it('copies the selected files under dest/<project>/', async () => {
    await put(sourceRoot, { ...sessionFixture(fakeKey()), ...noiseFixture })

    const report = await exportSessions({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(await listTree(dest)).toEqual(
      [
        `${OTHER_PROJECT}/s3.jsonl`,
        `${OTHER_PROJECT}/s3/subagents/agent-9.jsonl`,
        `${PROJECT}/s1.jsonl`,
        `${PROJECT}/s1/custom-title.json`,
        `${PROJECT}/s1/subagents/agent-1.jsonl`,
        `${PROJECT}/s1/tool-results/data.json`,
        `${PROJECT}/s1/tool-results/out.txt`,
        `${PROJECT}/s1/tool-results/shot.png`,
        `${PROJECT}/s2.jsonl`,
      ].sort(),
    )
    expect(report.files).toHaveLength(9)
  })

  it('masks keys and changes nothing else', async () => {
    const key = fakeKey()
    await put(sourceRoot, sessionFixture(key))

    await exportSessions({ sourceRoot, dest, prefix: PREFIX, secrets: [] })

    expect(await readFile(join(dest, PROJECT, 's1.jsonl'), 'utf8')).toBe(
      `{"a":"hello ${MASK}"}\n{"b":2}\n`,
    )
    expect(
      await readFile(join(dest, PROJECT, 's1/subagents/agent-1.jsonl'), 'utf8'),
    ).toBe(`{"c":"${MASK}","d":"${MASK}"}\n`)
    expect(
      await readFile(join(dest, PROJECT, 's1/tool-results/data.json'), 'utf8'),
    ).toBe(`{"k":"${MASK}"}`)
  })

  it('copies files without keys byte for byte', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))

    await exportSessions({ sourceRoot, dest, prefix: PREFIX, secrets: [] })

    expect(await readFile(join(dest, PROJECT, 's2.jsonl'))).toEqual(
      await readFile(join(sourceRoot, PROJECT, 's2.jsonl')),
    )
  })

  it('copies binary files byte for byte and never masks them', async () => {
    const key = fakeKey()
    const binary = Buffer.concat([PNG, Buffer.from(key), PNG])
    await put(sourceRoot, {
      [`${PROJECT}/s1.jsonl`]: '{}\n',
      [`${PROJECT}/s1/shot.png`]: binary,
    })

    const report = await exportSessions({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(await readFile(join(dest, PROJECT, 's1/shot.png'))).toEqual(binary)
    expect(
      report.files.find((file) => file.path.endsWith('.png')),
    ).toMatchObject({ spans: 0, text: false })
  })

  it('masks the exact secret value from the environment', async () => {
    const secret = 'not-prefixed-secret-value'
    await put(sourceRoot, {
      [`${PROJECT}/s1.jsonl`]: `{"v":"${secret}"}\n`,
    })

    const report = await exportSessions({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [secret],
    })

    expect(await readFile(join(dest, PROJECT, 's1.jsonl'), 'utf8')).toBe(
      `{"v":"${MASK}"}\n`,
    )
    expect(report.totalSpans).toBe(1)
  })

  it('reports files, bytes and masked spans per file', async () => {
    const key = fakeKey()
    await put(sourceRoot, sessionFixture(key))

    const report = await exportSessions({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    const byPath = Object.fromEntries(
      report.files.map((file) => [file.path, file]),
    )
    expect(byPath[`${PROJECT}/s1.jsonl`]).toMatchObject({
      spans: 1,
      text: true,
    })
    expect(byPath[`${PROJECT}/s1/subagents/agent-1.jsonl`]?.spans).toBe(2)
    expect(byPath[`${PROJECT}/s2.jsonl`]?.spans).toBe(0)
    expect(report.totalSpans).toBe(4)
    expect(report.totalBytes).toBe(
      report.files.reduce((sum, file) => sum + file.bytes, 0),
    )
    expect(report.files[0]?.bytes).toBe(
      (await stat(join(dest, report.files[0]?.path ?? ''))).size,
    )
  })

  it('never puts matched values in the report', async () => {
    const key = fakeKey()
    await put(sourceRoot, sessionFixture(key))

    const report = await exportSessions({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [key],
    })

    expect(JSON.stringify(report)).not.toContain(key)
  })

  it('replaces a previous export instead of merging', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))
    await put(dest, { [`${PROJECT}/stale.jsonl`]: 'stale\n' })

    await exportSessions({ sourceRoot, dest, prefix: PREFIX, secrets: [] })

    expect(await exists(join(dest, PROJECT, 'stale.jsonl'))).toBe(false)
    expect(await exists(join(dest, PROJECT, 's1.jsonl'))).toBe(true)
  })

  it('leaves no temporary folder behind', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))

    await exportSessions({ sourceRoot, dest, prefix: PREFIX, secrets: [] })

    expect(await readdir(dirname(dest))).toEqual(['ai-sessions'])
  })

  it('refuses a destination inside the source', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))

    await expect(
      exportSessions({
        sourceRoot,
        dest: join(sourceRoot, 'out'),
        prefix: PREFIX,
        secrets: [],
      }),
    ).rejects.toThrow(/overlap/i)
  })

  it('refuses a destination that contains the source', async () => {
    await put(sourceRoot, sessionFixture(fakeKey()))

    await expect(
      exportSessions({ sourceRoot, dest: root, prefix: PREFIX, secrets: [] }),
    ).rejects.toThrow(/overlap/i)
  })

  it('keeps the previous export when the source is missing', async () => {
    await put(dest, { [`${PROJECT}/keep.jsonl`]: 'keep\n' })

    await expect(
      exportSessions({
        sourceRoot: join(root, 'missing'),
        dest,
        prefix: PREFIX,
        secrets: [],
      }),
    ).rejects.toThrow()

    expect(await exists(join(dest, PROJECT, 'keep.jsonl'))).toBe(true)
  })
})

describe('verifyExport', () => {
  const exported = async (secrets: readonly string[] = []) => {
    const key = fakeKey()
    await put(sourceRoot, { ...sessionFixture(key), ...noiseFixture })
    await exportSessions({ sourceRoot, dest, prefix: PREFIX, secrets })
    return key
  }

  it('passes on a fresh export', async () => {
    await exported()

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report).toMatchObject({
      ok: true,
      checked: 9,
      identical: 9,
      grown: [],
      mismatched: [],
      missing: [],
      unexpected: [],
      residualKeys: 0,
      secretOccurrences: null,
    })
  })

  it('fails when an exported file differs beyond the masked spans', async () => {
    await exported()
    await appendFile(join(dest, PROJECT, 's2.jsonl'), 'tampered')

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.mismatched).toEqual([`${PROJECT}/s2.jsonl`])
  })

  it('fails when a binary file differs', async () => {
    await exported()
    await writeFile(
      join(dest, PROJECT, 's1/tool-results/shot.png'),
      PNG.subarray(1),
    )

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.mismatched).toEqual([`${PROJECT}/s1/tool-results/shot.png`])
  })

  it('fails when a selected file was not exported', async () => {
    await exported()
    await rm(join(dest, PROJECT, 's2.jsonl'))

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.missing).toEqual([`${PROJECT}/s2.jsonl`])
  })

  it('fails on files in the export that the source selection does not have', async () => {
    await exported()
    await put(dest, { [`${PROJECT}/extra.jsonl`]: '{}\n' })

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.unexpected).toEqual([`${PROJECT}/extra.jsonl`])
  })

  it('fails when a key was left in the export', async () => {
    await exported()
    const leaked = fakeKey()
    await put(sourceRoot, { [`${PROJECT}/s2.jsonl`]: `{"l":"${leaked}"}\n` })
    await put(dest, { [`${PROJECT}/s2.jsonl`]: `{"l":"${leaked}"}\n` })

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.residualKeys).toBe(1)
    expect(report.mismatched).toEqual([`${PROJECT}/s2.jsonl`])
  })

  it('counts the exact secret value in the export', async () => {
    const secret = 'not-prefixed-secret-value'
    await exported([secret])
    await put(dest, { [`${PROJECT}/s2.jsonl`]: `{"v":"${secret}"}\n` })

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [secret],
    })

    expect(report.ok).toBe(false)
    expect(report.secretOccurrences).toBe(1)
    expect(JSON.stringify(report)).not.toContain(secret)
  })

  it('reports zero occurrences when the secret is absent', async () => {
    const secret = 'not-prefixed-secret-value'
    await exported([secret])

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [secret],
    })

    expect(report.ok).toBe(true)
    expect(report.secretOccurrences).toBe(0)
  })

  it('tolerates a live session that grew after the export', async () => {
    await exported()
    await appendFile(join(sourceRoot, PROJECT, 's1.jsonl'), '{"later":true}\n')

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(true)
    expect(report.grown).toEqual([`${PROJECT}/s1.jsonl`])
    expect(report.identical).toBe(8)
  })

  it('does not call an empty exported .jsonl "grown"', async () => {
    await exported()
    await writeFile(join(dest, PROJECT, 's2.jsonl'), '')

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.grown).toEqual([])
    expect(report.mismatched).toEqual([`${PROJECT}/s2.jsonl`])
  })

  it('does not call a .jsonl cut in the middle of a line "grown"', async () => {
    await exported()
    await appendFile(join(sourceRoot, PROJECT, 's1.jsonl'), '{"later":true}\n')
    await writeFile(
      join(dest, PROJECT, 's1.jsonl'),
      `{"a":"hello ${MASK}"}\n{"b"`,
    )

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.grown).toEqual([])
    expect(report.mismatched).toEqual([`${PROJECT}/s1.jsonl`])
  })

  it.each([
    's1/tool-results/out.txt',
    's1/custom-title.json',
    's1/tool-results/shot.png',
  ])('does not call a grown %s "grown"', async (path) => {
    await exported()
    await appendFile(join(sourceRoot, PROJECT, path), '\n')

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.grown).toEqual([])
    expect(report.mismatched).toEqual([`${PROJECT}/${path}`])
  })

  it('accepts a grown subagent .jsonl that ends with a line break', async () => {
    await exported()
    await appendFile(
      join(sourceRoot, PROJECT, 's1/subagents/agent-1.jsonl'),
      '{"later":true}\n',
    )

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(true)
    expect(report.grown).toEqual([`${PROJECT}/s1/subagents/agent-1.jsonl`])
  })

  it('does not call a rewritten source "grown"', async () => {
    await exported()
    await writeFile(join(sourceRoot, PROJECT, 's2.jsonl'), '{"rewritten":1}\n')

    const report = await verifyExport({
      sourceRoot,
      dest,
      prefix: PREFIX,
      secrets: [],
    })

    expect(report.ok).toBe(false)
    expect(report.mismatched).toEqual([`${PROJECT}/s2.jsonl`])
  })
})

describe('swapInto', () => {
  const staged = async () => {
    const staging = join(root, '.export-sessions-abc')
    await put(staging, { 'new.jsonl': 'new\n' })
    return staging
  }

  it('replaces the previous folder and removes the backup', async () => {
    const staging = await staged()
    await put(dest, { 'old.jsonl': 'old\n' })

    await swapInto(staging, dest)

    expect(await listTree(dest)).toEqual(['new.jsonl'])
    expect(await readdir(root)).not.toContain('.export-sessions-abc')
    expect(await readdir(root)).not.toContain('.export-sessions-abc.previous')
  })

  it('works when there is no previous folder', async () => {
    const staging = await staged()
    await mkdir(dirname(dest), { recursive: true })

    await swapInto(staging, dest)

    expect(await listTree(dest)).toEqual(['new.jsonl'])
  })

  it('restores the previous folder and keeps the staging one when the swap fails', async () => {
    const staging = await staged()
    await put(dest, { 'old.jsonl': 'old\n' })
    const failingSecondRename: typeof rename = (from, to) =>
      from === staging
        ? Promise.reject(new Error('rename failed'))
        : rename(from, to)

    await expect(swapInto(staging, dest, failingSecondRename)).rejects.toThrow(
      /rename failed/,
    )

    expect(await listTree(dest)).toEqual(['old.jsonl'])
    expect(await listTree(staging)).toEqual(['new.jsonl'])
    expect(await readdir(root)).not.toContain('.export-sessions-abc.previous')
  })
})
