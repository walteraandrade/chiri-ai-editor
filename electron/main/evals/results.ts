import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseSummaryBaseline } from '../../../src/evals/baseline'

export type NextRun = {
  readonly jsonFile: string
  readonly outputDir: string
}

export type RunPart = 'today' | 'version'

export type LastRun = {
  readonly baselineText: string | null
  readonly firstText: string
  readonly secondText: string | null
}

export type ResultsStore = {
  readonly begin: (skillKey: string) => Promise<NextRun>
  readonly beginPart: (skillKey: string, part: RunPart) => Promise<NextRun>
  readonly readNext: (
    skillKey: string,
    part?: RunPart,
  ) => Promise<string | null>
  readonly writeBaseline: (skillKey: string, text: string) => Promise<void>
  readonly promote: (skillKey: string) => Promise<void>
  readonly discard: (skillKey: string) => Promise<void>
  readonly readLast: (skillKey: string) => Promise<LastRun | null>
  readonly lastReport: (
    skillKey: string,
    part?: RunPart,
  ) => Promise<string | null>
}

export const skillKeyOf = (realPath: string): string =>
  createHash('sha256').update(realPath).digest('hex')

const RESULT_FILE = 'result.json'
const REPORT_DIR = 'report'
const REPORT_FILE = 'report.html'
const BASELINE_FILE = 'baseline.json'

const readOrNull = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

const filesIn = (dir: string): NextRun => ({
  jsonFile: join(dir, RESULT_FILE),
  outputDir: join(dir, REPORT_DIR),
})

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

  const lastLayout = async (
    skillKey: string,
  ): Promise<{
    readonly baselineText: string | null
    readonly pair: boolean
  }> => {
    const baselineText = await readOrNull(
      join(lastDir(skillKey), BASELINE_FILE),
    )
    const baseline =
      baselineText === null ? null : parseSummaryBaseline(baselineText)
    return { baselineText, pair: baseline?.kind === 'version' }
  }

  return {
    begin: async (skillKey) => {
      await discard(skillKey)
      const dir = nextDir(skillKey)
      await mkdir(dir, { recursive: true })
      return filesIn(dir)
    },
    beginPart: async (skillKey, part) => {
      const dir = join(nextDir(skillKey), part)
      await mkdir(dir, { recursive: true })
      return filesIn(dir)
    },
    readNext: (skillKey, part) =>
      readOrNull(
        join(
          part === undefined
            ? nextDir(skillKey)
            : join(nextDir(skillKey), part),
          RESULT_FILE,
        ),
      ),
    writeBaseline: (skillKey, text) =>
      writeFile(join(nextDir(skillKey), BASELINE_FILE), text, 'utf8'),
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
    readLast: async (skillKey) => {
      const { baselineText, pair } = await lastLayout(skillKey)
      const dir = lastDir(skillKey)
      const firstText = await readOrNull(
        join(pair ? join(dir, 'today') : dir, RESULT_FILE),
      )
      if (firstText === null) return null
      return {
        baselineText,
        firstText,
        secondText: pair
          ? await readOrNull(join(dir, 'version', RESULT_FILE))
          : null,
      }
    },
    lastReport: async (skillKey, part = 'today') => {
      const { pair } = await lastLayout(skillKey)
      if (!pair && part === 'version') return null
      const dir = lastDir(skillKey)
      const file = join(pair ? join(dir, part) : dir, REPORT_DIR, REPORT_FILE)
      try {
        return (await stat(file)).isFile() ? file : null
      } catch {
        return null
      }
    },
  }
}
