import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BOOK_PALETTES, CHIRI_THEME, THEME_OPTIONS, themeById } from './catalog'
import { contrast, rgbOf } from './color'
import wadaColors from './testing/wada-colors.json'
import type { ThemeRoles } from './tokens'

const AA = 4.5

const BOOK = new Map(wadaColors.map((color) => [color.name, color]))

const combination = (id: number): readonly string[] =>
  wadaColors
    .filter((color) => color.combinations.includes(id))
    .map((color) => color.name)

const labOf = (name: string): readonly number[] => {
  const color = BOOK.get(name)
  if (!color) throw new Error(`Not in the book: ${name}`)
  return color.lab
}

const labDistance = (a: string, b: string): number =>
  Math.hypot(...labOf(a).map((value, index) => value - (labOf(b)[index] ?? 0)))

const chroma = (name: string): number => {
  const [, a = 0, b = 0] = labOf(name)
  return Math.hypot(a, b)
}

const isReddish = (hex: string): boolean => {
  const [r = 0, g = 0, b = 0] = rgbOf(hex).map((value) => value / 255)
  const max = Math.max(r, g, b)
  const span = max - Math.min(r, g, b)
  const saturation = max === 0 ? 0 : span / max
  const hue = max === r && span > 0 ? (((g - b) / span) * 60 + 360) % 360 : -1
  return hue >= 0 && (hue <= 18 || hue >= 340) && saturation >= 0.45
}

const expectLegible = (roles: ThemeRoles): void => {
  const pairs: readonly (readonly [string, string])[] = [
    [roles.ink, roles.canvas],
    [roles.ink, roles.raised],
    [roles.ink, roles.fill],
    [roles.ink, roles.fillHover],
    [roles.ink, roles.selection],
    [roles.ai, roles.canvas],
    [roles.ai, roles.raised],
    [roles.ai, roles.selection],
    [roles.canvas, roles.ai],
    [roles.accent, roles.canvas],
    [roles.accent, roles.raised],
    [roles.faint, roles.canvas],
    [roles.faint, roles.raised],
    [roles.danger, roles.canvas],
    [roles.danger, roles.raised],
  ]
  for (const [text, background] of pairs)
    expect(contrast(text, background)).toBeGreaterThanOrEqual(AA)
}

describe('book palettes', () => {
  it('ships 24 palettes with unique ids and titles', () => {
    expect(BOOK_PALETTES).toHaveLength(24)
    expect(new Set(BOOK_PALETTES.map(({ id }) => id)).size).toBe(24)
    expect(new Set(BOOK_PALETTES.map(({ title }) => title)).size).toBe(24)
  })

  it.each(BOOK_PALETTES)('$title uses only exact book codes', ({ colors }) => {
    for (const { name, hex } of colors) expect(BOOK.get(name)?.hex).toBe(hex)
  })

  it.each(BOOK_PALETTES)(
    '$title joins two combinations that share a color',
    ({ colors, source: [first, second] }) => {
      const a = combination(first)
      const b = combination(second)
      expect(a.some((name) => b.includes(name))).toBe(true)
      expect(colors.map(({ name }) => name).sort()).toEqual(
        [...new Set([...a, ...b])].sort(),
      )
    },
  )

  it.each(BOOK_PALETTES)('$title has at least six colors', ({ colors }) => {
    expect(colors.length).toBeGreaterThanOrEqual(6)
  })

  it.each(BOOK_PALETTES)(
    '$title gives every color a job',
    ({ colors, jobs }) => {
      expect(new Set(Object.values(jobs))).toEqual(
        new Set(colors.map(({ name }) => name)),
      )
    },
  )

  it.each(BOOK_PALETTES)('$title keeps a real AI hue and a red', ({ jobs }) => {
    expect(chroma(jobs.ai)).toBeGreaterThanOrEqual(20)
    expect(labDistance(jobs.ai, jobs.ink)).toBeGreaterThanOrEqual(25)
    expect(labDistance(jobs.ai, jobs.danger)).toBeGreaterThanOrEqual(25)
    expect(isReddish(BOOK.get(jobs.danger)?.hex ?? '')).toBe(true)
  })

  it.each(BOOK_PALETTES)(
    '$title paints only its own colors',
    ({ id, colors }) => {
      const codes = colors.map(({ hex }) => hex)
      for (const value of Object.values(themeById(id)?.tokens.roles ?? {}))
        expect(codes).toContain(value)
    },
  )

  it.each(BOOK_PALETTES)('$title passes AA', ({ id }) => {
    const option = themeById(id)
    expect(option).not.toBeNull()
    if (option) expectLegible(option.tokens.roles)
  })

  it.each(BOOK_PALETTES)('$title declares its mode', ({ id, mode }) => {
    const roles = themeById(id)?.tokens.roles
    if (!roles) throw new Error('missing')
    const darkCanvas =
      contrast(roles.canvas, '#000000') < contrast(roles.ink, '#000000')
    expect(mode).toBe(darkCanvas ? 'dark' : 'light')
  })
})

describe('the Chiri theme', () => {
  it('passes AA', () => {
    expectLegible(CHIRI_THEME.tokens.roles)
  })

  it('matches the stylesheet defaults', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8')
    const seed = (name: string): string | undefined =>
      new RegExp(`--theme-${name}: (#[0-9a-f]+);`).exec(css)?.[1]
    const { roles } = CHIRI_THEME.tokens
    expect(seed('canvas')).toBe(roles.canvas)
    expect(seed('raised')).toBe(roles.raised)
    expect(seed('ink')).toBe(roles.ink)
    expect(seed('faint')).toBe(roles.faint)
    expect(seed('accent')).toBe(roles.accent)
    expect(seed('ai')).toBe(roles.ai)
    expect(seed('danger')).toBe(roles.danger)
    expect(seed('selection')).toBe(roles.selection)
    expect(seed('fill')).toBe(roles.fill)
    expect(seed('fill-hover')).toBe(roles.fillHover)
    expect(seed('hairline')).toBe(roles.hairline)
    expect(seed('scrollbar')).toBe(roles.scrollbar)
  })
})

describe('theme options', () => {
  it('lists the Chiri theme first, then every palette', () => {
    expect(THEME_OPTIONS).toHaveLength(25)
    expect(THEME_OPTIONS[0]).toBe(CHIRI_THEME)
  })

  it('finds an option by id and answers null otherwise', () => {
    expect(themeById(CHIRI_THEME.id)).toBe(CHIRI_THEME)
    expect(themeById('neon')).toBeNull()
  })
})
