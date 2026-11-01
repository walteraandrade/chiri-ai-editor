import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bareImports } from './externals.ts'

const BUNDLES = ['out/main', 'out/preload']

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesIn(join(dir, entry.name))
      : /\.(c|m)?js$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )

const externals = BUNDLES.flatMap((dir) =>
  filesIn(dir).flatMap((file) =>
    bareImports(readFileSync(file, 'utf8')).map((name) => `${file}: ${name}`),
  ),
)

if (externals.length > 0) {
  console.error(
    `Runtime externals found; the package does not ship node_modules:\n${externals.join('\n')}`,
  )
  process.exit(1)
}
console.log('No runtime externals in out/main or out/preload.')
