import { describe, expect, it } from 'vitest'
import { THEME_VARIABLE_NAMES, themeLabel, themeVariables } from './tokens'

describe('themeVariables', () => {
  it('maps every role to a theme custom property', () => {
    expect(
      themeVariables({
        name: 'tokyo-night',
        mode: 'dark',
        roles: {
          canvas: '#000001',
          raised: '#000002',
          ink: '#000003',
          faint: '#000004',
          accent: '#000005',
          ai: '#000006',
          danger: '#000007',
          selection: '#000008',
          fill: '#000009',
          fillHover: '#00000a',
          hairline: '#00000b',
          scrollbar: '#00000c',
        },
      }),
    ).toEqual({
      '--theme-canvas': '#000001',
      '--theme-raised': '#000002',
      '--theme-ink': '#000003',
      '--theme-faint': '#000004',
      '--theme-accent': '#000005',
      '--theme-ai': '#000006',
      '--theme-danger': '#000007',
      '--theme-selection': '#000008',
      '--theme-fill': '#000009',
      '--theme-fill-hover': '#00000a',
      '--theme-hairline': '#00000b',
      '--theme-scrollbar': '#00000c',
    })
  })

  it('names the same variables it writes', () => {
    expect(THEME_VARIABLE_NAMES).toHaveLength(12)
  })
})

describe('themeLabel', () => {
  it('title-cases a slug', () => {
    expect(themeLabel('tokyo-night')).toBe('Tokyo Night')
    expect(themeLabel('rose_pine moon')).toBe('Rose Pine Moon')
  })
})
