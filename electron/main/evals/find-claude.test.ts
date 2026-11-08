import { describe, expect, it } from 'vitest'
import { findClaude } from './find-claude'

const only =
  (...found: string[]) =>
  async (path: string): Promise<boolean> =>
    found.includes(path)

describe('findClaude', () => {
  it('takes the first match on PATH', async () => {
    expect(
      await findClaude({
        path: '/a/bin:/b/bin',
        home: '/home/u',
        isExecutable: only('/b/bin/claude', '/a/bin/claude'),
      }),
    ).toBe('/a/bin/claude')
  })

  it('falls back to ~/.local/bin/claude', async () => {
    expect(
      await findClaude({
        path: '/a/bin',
        home: '/home/u',
        isExecutable: only('/home/u/.local/bin/claude'),
      }),
    ).toBe('/home/u/.local/bin/claude')
  })

  it('works with no PATH at all', async () => {
    expect(
      await findClaude({
        path: undefined,
        home: '/home/u',
        isExecutable: only('/home/u/.local/bin/claude'),
      }),
    ).toBe('/home/u/.local/bin/claude')
  })

  it('returns null when it is nowhere', async () => {
    expect(
      await findClaude({
        path: '/a/bin',
        home: '/home/u',
        isExecutable: only(),
      }),
    ).toBeNull()
  })
})
