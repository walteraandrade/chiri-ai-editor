import { describe, expect, it, vi } from 'vitest'
import { resolveDevDialogs } from './dev-dialogs'

const DEV = { ELECTRON_RENDERER_URL: 'http://localhost:5302' }

describe('resolveDevDialogs', () => {
  it('is off in the production build, where no dev server sets the URL', () => {
    expect(
      resolveDevDialogs({ CHIRI_DEV_PICK_FILE: '/tmp/pick.txt' }, vi.fn()),
    ).toBeUndefined()
  })

  it('is off without the switch', () => {
    expect(resolveDevDialogs(DEV, vi.fn())).toBeUndefined()
    expect(
      resolveDevDialogs({ ...DEV, CHIRI_DEV_PICK_FILE: '  ' }, vi.fn()),
    ).toBeUndefined()
  })

  it('refuses a relative path for the switch', () => {
    expect(
      resolveDevDialogs({ ...DEV, CHIRI_DEV_PICK_FILE: 'pick.txt' }, vi.fn()),
    ).toBeUndefined()
  })

  it('answers every dialog with the path in the file, read when the dialog opens', async () => {
    const read = vi
      .fn<(path: string) => Promise<string>>()
      .mockResolvedValueOnce('/skills/a/SKILL.md\n')
      .mockResolvedValueOnce('/skills/b/SKILL.md\n')
      .mockResolvedValueOnce('/tmp/copy.md')
    const dialogs = resolveDevDialogs(
      { ...DEV, CHIRI_DEV_PICK_FILE: '/tmp/pick.txt' },
      read,
    )
    expect(await dialogs?.pickFile(null)).toBe('/skills/a/SKILL.md')
    expect(await dialogs?.pickFile(null)).toBe('/skills/b/SKILL.md')
    expect(await dialogs?.pickSavePath(null, 'a.md')).toBe('/tmp/copy.md')
    expect(read).toHaveBeenCalledWith('/tmp/pick.txt')
  })

  it('cancels the dialog when the file is empty or cannot be read', async () => {
    const dialogs = resolveDevDialogs(
      { ...DEV, CHIRI_DEV_PICK_FILE: '/tmp/pick.txt' },
      vi
        .fn<(path: string) => Promise<string>>()
        .mockResolvedValueOnce('\n')
        .mockRejectedValueOnce(new Error('ENOENT')),
    )
    expect(await dialogs?.pickFile(null)).toBeNull()
    expect(await dialogs?.pickFile(null)).toBeNull()
  })
})
