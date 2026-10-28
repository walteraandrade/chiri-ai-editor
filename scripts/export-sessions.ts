import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  type ExportOptions,
  type ExportReport,
  exportSessions,
  type VerifyReport,
  verifyExport,
} from './session-export'

const DEFAULT_PREFIX = '-home-walter-Github-chiri-ai-editor'
const DEFAULT_DEST = 'ai-sessions'
const KEY_VARIABLE = 'OPENROUTER_API_KEY'

const USAGE = `Usage: pnpm export-sessions [--verify] [--source <dir>] [--dest <dir>] [--prefix <name>]

  --source  Claude Code projects folder (default: ~/.claude/projects)
  --dest    Export folder, replaced on every run (default: ./${DEFAULT_DEST})
  --prefix  Project folder name prefix to export (default: ${DEFAULT_PREFIX})
  --verify  Compare an existing export with the source instead of exporting`

const loadDotEnv = (): void => {
  if (existsSync('.env')) process.loadEnvFile('.env')
}

const secretsFromEnvironment = (): readonly string[] => {
  const value = (process.env[KEY_VARIABLE] ?? '').trim()
  return value === '' ? [] : [value]
}

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`

const printExport = (report: ExportReport, dest: string): void => {
  const masked = report.files.filter((file) => file.spans > 0)
  console.log(
    `exported ${plural(report.files.length, 'file')}, ${report.totalBytes} bytes, ${plural(report.totalSpans, 'masked span')} in ${plural(masked.length, 'file')} -> ${dest}`,
  )
  for (const file of masked) {
    console.log(`  ${String(file.spans).padStart(5)} masked  ${file.path}`)
  }
}

const printList = (title: string, paths: readonly string[]): void => {
  console.log(`  ${title}: ${paths.length}`)
  for (const path of paths) console.log(`    ${path}`)
}

const printVerify = (report: VerifyReport, hasSecret: boolean): void => {
  console.log(`verified ${plural(report.checked, 'file')} against the source`)
  console.log(`  identical to the masked source: ${report.identical}`)
  printList(
    'grown since the export (live session, exported part matches)',
    report.grown,
  )
  printList('different from the masked source', report.mismatched)
  printList('missing from the export', report.missing)
  printList('in the export but not selected from the source', report.unexpected)
  console.log(`  "sk-or-" followed by a key character: ${report.residualKeys}`)
  console.log(
    hasSecret
      ? `  ${KEY_VARIABLE} value occurrences: ${report.secretOccurrences}`
      : `  ${KEY_VARIABLE} value occurrences: not checked (variable not set)`,
  )
  console.log(report.ok ? 'verify: ok' : 'verify: FAILED')
}

const main = async (): Promise<number> => {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      dest: { type: 'string' },
      prefix: { type: 'string' },
      verify: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (values.help) {
    console.log(USAGE)
    return 0
  }
  loadDotEnv()
  const options: ExportOptions = {
    sourceRoot: resolve(
      values.source ?? join(homedir(), '.claude', 'projects'),
    ),
    dest: resolve(values.dest ?? DEFAULT_DEST),
    prefix: values.prefix ?? DEFAULT_PREFIX,
    secrets: secretsFromEnvironment(),
  }
  if (values.verify) {
    const report = await verifyExport(options)
    printVerify(report, options.secrets.length > 0)
    return report.ok ? 0 : 1
  }
  printExport(await exportSessions(options), options.dest)
  return 0
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  },
)
