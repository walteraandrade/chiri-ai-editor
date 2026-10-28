import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  countSecretOccurrences,
  isTextFile,
  maskBytes,
  residualKeyCount,
} from './session-masking'

export type SessionFile = {
  readonly project: string
  readonly path: string
}

export type ExportOptions = {
  readonly sourceRoot: string
  readonly dest: string
  readonly prefix: string
  readonly secrets: readonly string[]
}

export type ExportedFile = {
  readonly path: string
  readonly bytes: number
  readonly spans: number
  readonly text: boolean
}

export type ExportReport = {
  readonly files: readonly ExportedFile[]
  readonly totalBytes: number
  readonly totalSpans: number
}

export type VerifyReport = {
  readonly checked: number
  readonly identical: number
  readonly grown: readonly string[]
  readonly mismatched: readonly string[]
  readonly missing: readonly string[]
  readonly unexpected: readonly string[]
  readonly residualKeys: number
  readonly secretOccurrences: number | null
  readonly ok: boolean
}

type Comparison = 'identical' | 'grown' | 'mismatched' | 'missing'

const SESSION_EXTENSION = '.jsonl'

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const mapSequential = <T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<readonly R[]> =>
  items.reduce<Promise<readonly R[]>>(
    async (acc, item) => [...(await acc), await fn(item)],
    Promise.resolve([]),
  )

const toPosix = (path: string): string => path.split(sep).join('/')

const keyOf = (file: SessionFile): string => `${file.project}/${file.path}`

const isInside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return (
    rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
}

const assertDisjoint = (sourceRoot: string, dest: string): void => {
  const source = resolve(sourceRoot)
  const target = resolve(dest)
  if (isInside(source, target) || isInside(target, source)) {
    throw new Error(`Source and destination overlap: ${source} and ${target}`)
  }
}

const readDirents = (dir: string, label: string) =>
  readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    throw new Error(`${label} folder not readable: ${dir}`, { cause: error })
  })

const listFilesUnder = async (
  dir: string,
  label: string,
): Promise<readonly string[]> =>
  (
    await readdir(dir, { recursive: true, withFileTypes: true }).catch(
      (error: unknown) => {
        throw new Error(`${label} folder not readable: ${dir}`, {
          cause: error,
        })
      },
    )
  )
    .filter((entry) => entry.isFile())
    .map((entry) => toPosix(relative(dir, join(entry.parentPath, entry.name))))
    .sort(byText)

const listProjectFiles = async (
  sourceRoot: string,
  project: string,
): Promise<readonly SessionFile[]> => {
  const projectDir = join(sourceRoot, project)
  const entries = await readDirents(projectDir, 'Source')
  const sessions = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(SESSION_EXTENSION) &&
      entry.name.length > SESSION_EXTENSION.length,
  )
  const nested = await mapSequential(sessions, async (session) => {
    const stem = session.name.slice(0, -SESSION_EXTENSION.length)
    const hasSibling = entries.some(
      (entry) => entry.isDirectory() && entry.name === stem,
    )
    const inside = hasSibling
      ? (await listFilesUnder(join(projectDir, stem), 'Source')).map(
          (path) => `${stem}/${path}`,
        )
      : []
    return [session.name, ...inside]
  })
  return nested
    .flat()
    .sort(byText)
    .map((path) => ({ project, path }))
}

export const listSessionFiles = async (
  sourceRoot: string,
  prefix: string,
): Promise<readonly SessionFile[]> => {
  const projects = (await readDirents(sourceRoot, 'Source'))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort(byText)
  return (
    await mapSequential(projects, (project) =>
      listProjectFiles(sourceRoot, project),
    )
  ).flat()
}

const expectedBytes = (
  file: SessionFile,
  source: Buffer,
  secrets: readonly string[],
): {
  readonly bytes: Buffer
  readonly spans: number
  readonly text: boolean
} =>
  isTextFile(file.path, source)
    ? { ...maskBytes(source, secrets), text: true }
    : { bytes: source, spans: 0, text: false }

const copyFile =
  (sourceRoot: string, staging: string, secrets: readonly string[]) =>
  async (file: SessionFile): Promise<ExportedFile> => {
    const source = await readFile(join(sourceRoot, file.project, file.path))
    const { bytes, spans, text } = expectedBytes(file, source, secrets)
    const target = join(staging, file.project, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
    return { path: keyOf(file), bytes: bytes.length, spans, text }
  }

export const exportSessions = async ({
  sourceRoot,
  dest,
  prefix,
  secrets,
}: ExportOptions): Promise<ExportReport> => {
  assertDisjoint(sourceRoot, dest)
  const files = await listSessionFiles(sourceRoot, prefix)
  const target = resolve(dest)
  await mkdir(dirname(target), { recursive: true })
  const staging = await mkdtemp(join(dirname(target), '.export-sessions-'))
  try {
    const exported = await mapSequential(
      files,
      copyFile(sourceRoot, staging, secrets),
    )
    await rm(target, { recursive: true, force: true })
    await rename(staging, target)
    return {
      files: exported,
      totalBytes: exported.reduce((sum, file) => sum + file.bytes, 0),
      totalSpans: exported.reduce((sum, file) => sum + file.spans, 0),
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

const isPrefixOf = (prefix: Buffer, whole: Buffer): boolean =>
  prefix.length < whole.length &&
  whole.subarray(0, prefix.length).equals(prefix)

const readIfPresent = (path: string): Promise<Buffer | null> =>
  readFile(path).then(
    (bytes): Buffer | null => bytes,
    () => null,
  )

const compare =
  (sourceRoot: string, dest: string, secrets: readonly string[]) =>
  async (
    file: SessionFile,
  ): Promise<{ readonly key: string; readonly result: Comparison }> => {
    const source = await readFile(join(sourceRoot, file.project, file.path))
    const expected = expectedBytes(file, source, secrets).bytes
    const actual = await readIfPresent(join(dest, file.project, file.path))
    const result: Comparison =
      actual === null
        ? 'missing'
        : actual.equals(expected)
          ? 'identical'
          : isPrefixOf(actual, expected)
            ? 'grown'
            : 'mismatched'
    return { key: keyOf(file), result }
  }

const scanExported =
  (dest: string, secrets: readonly string[]) =>
  async (
    path: string,
  ): Promise<{ readonly residual: number; readonly secretHits: number }> => {
    const bytes = await readFile(join(dest, path))
    return {
      residual: residualKeyCount(bytes.toString('latin1')),
      secretHits: countSecretOccurrences(bytes, secrets),
    }
  }

export const verifyExport = async ({
  sourceRoot,
  dest,
  prefix,
  secrets,
}: ExportOptions): Promise<VerifyReport> => {
  const files = await listSessionFiles(sourceRoot, prefix)
  const exportedPaths = await listFilesUnder(resolve(dest), 'Export')
  const expectedKeys = new Set(files.map(keyOf))
  const comparisons = await mapSequential(
    files,
    compare(sourceRoot, resolve(dest), secrets),
  )
  const scans = await mapSequential(
    exportedPaths,
    scanExported(resolve(dest), secrets),
  )
  const keysWith = (wanted: Comparison): readonly string[] =>
    comparisons.filter(({ result }) => result === wanted).map(({ key }) => key)
  const unexpected = exportedPaths.filter((path) => !expectedKeys.has(path))
  const residualKeys = scans.reduce((sum, scan) => sum + scan.residual, 0)
  const secretOccurrences =
    secrets.length === 0
      ? null
      : scans.reduce((sum, scan) => sum + scan.secretHits, 0)
  const mismatched = keysWith('mismatched')
  const missing = keysWith('missing')
  return {
    checked: files.length,
    identical: keysWith('identical').length,
    grown: keysWith('grown'),
    mismatched,
    missing,
    unexpected,
    residualKeys,
    secretOccurrences,
    ok:
      mismatched.length === 0 &&
      missing.length === 0 &&
      unexpected.length === 0 &&
      residualKeys === 0 &&
      (secretOccurrences ?? 0) === 0,
  }
}
