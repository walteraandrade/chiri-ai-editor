import { describe, expect, it } from 'vitest'
import { themeLabel, themeVariables } from './tokens'

describe('themeVariables', () => {
  it('maps tokens to theme custom properties', () => {
    expect(
      themeVariables({
        name: 'tokyo-night',
        mode: 'dark',
        bg: '#1a1b26',
        raised: '#24283b',
        ink: '#a9b1d6',
        inkStrong: '#c0caf5',
        accent: '#7aa2f7',
        ai: '#7aa2f7',
        danger: '#f7768e',
        selection: '#292e42',
      }),
    ).toEqual({
      '--theme-bg': '#1a1b26',
      '--theme-raised': '#24283b',
      '--theme-ink': '#a9b1d6',
      '--theme-ink-strong': '#c0caf5',
      '--theme-accent': '#7aa2f7',
      '--theme-ai': '#7aa2f7',
      '--theme-danger': '#f7768e',
      '--theme-selection': '#292e42',
    })
  })

  it('leaves missing colors to the stylesheet defaults', () => {
    expect(
      themeVariables({
        name: 'latte',
        mode: 'light',
        bg: '#eff1f5',
        raised: null,
        ink: '#4c4f69',
        inkStrong: '#4c4f69',
        accent: '#1e66f5',
        ai: '#1e66f5',
        danger: null,
        selection: null,
      }),
    ).toEqual({
      '--theme-bg': '#eff1f5',
      '--theme-ink': '#4c4f69',
      '--theme-ink-strong': '#4c4f69',
      '--theme-accent': '#1e66f5',
      '--theme-ai': '#1e66f5',
    })
  })
})

describe('themeLabel', () => {
  it('title-cases a theme directory name', () => {
    expect(themeLabel('tokyo-night')).toBe('Tokyo Night')
    expect(themeLabel('vantablack')).toBe('Vantablack')
    expect(themeLabel('rose_pine  moon')).toBe('Rose Pine Moon')
  })
})
