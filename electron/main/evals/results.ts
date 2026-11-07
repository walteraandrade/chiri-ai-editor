import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

export type NextRun = {
  readonly jsonFile: string
  readonly outputDir: string
}

export type ResultsStore = {
  readonly begin: (skillKey: string) => Promise<NextRun>
  readonly readNext: (skillKey: string) => Promise<string | null>
  readonly promote: (skillKey: string) => Promise<void>
  readonly discard: (skillKey: string) => Promise<void>
  readonly readLast: (skillKey: string) => Promise<string | null>
  readonly lastReport: (skillKey: string) => Promise<string | null>
}

export const skillKeyOf = (realPath: string): string =>
  createHash('sha256').update(realPath).digest('hex')

const RESULT_FILE = 'result.json'
const REPORT_DIR = 'report'
const REPORT_FILE = 'report.html'

const readOrNull = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

export const createResultsStore = (
  userDataDir: string,
  renamePath: typeof rename = rename,
): ResultsStore => {
  const skillDir = (skillKey: string): string =>
    join(userDataDir, 'eval-runs', skillKey)
  const nextDir = (skillKey: string): string => join(skillDir(skillKey), 'next')
  const lastDir = (skillKey: string): string => join(skillDir(skillKey), 'last')
  const retiredDir = (skillKey: string): string =>
    join(skillDir(skillKey), 'retired')
  const discard = (skillKey: string): Promise<void> =>
    rm(nextDir(skillKey), { recursive: true, force: true })

  return {
    begin: async (skillKey) => {
      await discard(skillKey)
      const dir = nextDir(skillKey)
      await mkdir(dir, { recursive: true })
      return {
        jsonFile: join(dir, RESULT_FILE),
        outputDir: join(dir, REPORT_DIR),
      }
    },
    readNext: (skillKey) => readOrNull(join(nextDir(skillKey), RESULT_FILE)),
    promote: async (skillKey) => {
      const retired = retiredDir(skillKey)
      await rm(retired, { recursive: true, force: true })
      const hadLast = await renamePath(lastDir(skillKey), retired).then(
        () => true,
        () => false,
      )
      try {
        await renamePath(nextDir(skillKey), lastDir(skillKey))
      } catch (error) {
        if (hadLast) await renamePath(retired, lastDir(skillKey))
        throw error
      }
      await rm(retired, { recursive: true, force: true })
    },
    discard,
    readLast: (skillKey) => readOrNull(join(lastDir(skillKey), RESULT_FILE)),
    lastReport: async (skillKey) => {
      const file = join(lastDir(skillKey), REPORT_DIR, REPORT_FILE)
      try {
        return (await stat(file)).isFile() ? file : null
      } catch {
        return null
      }
    },
  }
}
