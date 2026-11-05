import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

const sourceFiles = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(css|tsx?)$/.test(entry.name) && !entry.name.includes('.test.')
      ? [path]
      : []
  })

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ['color-mix', /color-mix\(/],
  ['box-shadow', /box-shadow:/],
  ['shadow utility', /\bshadow-(float|lg|md|sm|xl)\b/],
  ['alpha color utility', /\b(bg|text|border|ring|outline)-[a-z-]+\/\d+/],
  ['alpha color function', /rgba?\([^)]*\/\s*0?\.\d+\)/],
]

describe('the hard rule', () => {
  it.each(FORBIDDEN)('finds no %s in the renderer', (_label, pattern) => {
    const offenders = sourceFiles(SRC).filter((file) =>
      pattern.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
