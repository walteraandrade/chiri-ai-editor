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

const FORBIDDEN: readonly (readonly [string, RegExp, string])[] = [
  ['color-mix', /color-mix\(/, 'color-mix(in oklab, red, blue)'],
  ['box-shadow', /box-shadow:|boxShadow/, 'boxShadow: "none"'],
  ['shadow utility', /\bshadow-[a-z0-9]+\b/, 'p-2 shadow-2xl'],
  ['ring utility', /\bring-[a-z0-9]+\b/, 'focus-visible:ring-1'],
  [
    'alpha color utility',
    /\b(bg|text|border|ring|outline|fill|stroke|divide|decoration|caret|accent|placeholder|from|via|to)-[a-z-]+\/\d+/,
    'hover:bg-accent/10',
  ],
  [
    'alpha color function',
    /(rgb|hsl)a?\([^)]*[,/]\s*0?\.\d+\s*\)/,
    'rgba(0, 0, 0, 0.5)',
  ],
  ['alpha hex', /#[0-9a-f]{8}\b/i, '#ff800080'],
  [
    'filter utility',
    /\b(brightness|backdrop-blur)-[a-z0-9]+/,
    'hover:brightness-110',
  ],
]

const AT_REST_IN_STYLESHEETS: readonly (readonly [string, RegExp, string])[] = [
  ['text-shadow', /text-shadow:/, '.a { text-shadow: 0 0 1px red; }'],
  ['filter', /(^|[\s;{])(backdrop-)?filter:/, '.a { filter: blur(3px); }'],
  ['partial opacity', /opacity:\s*0?\.\d/, '.a { opacity: 0.5; }'],
]

const atRest = (css: string): string =>
  css.replace(/@keyframes[^{]+\{[\s\S]*?\n\}/g, '')

describe('the hard rule', () => {
  it('reads the renderer sources', () => {
    const files = sourceFiles(SRC)
    expect(files.some((file) => file.endsWith('index.css'))).toBe(true)
    expect(files.some((file) => file.endsWith('App.tsx'))).toBe(true)
  })

  it.each(AT_REST_IN_STYLESHEETS)(
    'recognizes %s',
    (_label, pattern, sample) => {
      expect(pattern.test(atRest(sample))).toBe(true)
    },
  )

  it('lets a stylesheet animate through what it may not hold', () => {
    const css = '@keyframes a {\n  from {\n    opacity: 0.5;\n  }\n}\n.b {}\n'
    for (const [, pattern] of AT_REST_IN_STYLESHEETS)
      expect(pattern.test(atRest(css))).toBe(false)
  })

  it.each(AT_REST_IN_STYLESHEETS)(
    'finds no %s at rest in the stylesheets',
    (_label, pattern) => {
      const offenders = sourceFiles(SRC)
        .filter((file) => file.endsWith('.css'))
        .filter((file) => pattern.test(atRest(readFileSync(file, 'utf8'))))
      expect(offenders).toEqual([])
    },
  )

  it.each(FORBIDDEN)('recognizes %s', (_label, pattern, sample) => {
    expect(pattern.test(sample)).toBe(true)
  })

  it.each(FORBIDDEN)('finds no %s in the renderer', (_label, pattern) => {
    const offenders = sourceFiles(SRC).filter((file) =>
      pattern.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
