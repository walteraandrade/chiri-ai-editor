import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileSession } from './file-session'
import { createUnsavedKeeper } from './unsaved-keeper'

const session = (ref: string, savedText: string): FileSession<string> => ({
  name: 'SKILL.md',
  ref,
  savedText,
  dirty: false,
})

const setup = () => {
  const keep = vi.fn()
  const drop = vi.fn()
  const keeper = createUnsavedKeeper<string>({
    store: { keep, drop },
    delayMs: 400,
  })
  return { keeper, keep, drop }
}

describe('createUnsavedKeeper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the unsaved text with the text it started from, after the delay', () => {
    const { keeper, keep } = setup()
    keeper.track('# A, edited\n', session('/a.md', '# A\n'))
    expect(keep).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(keep).toHaveBeenCalledWith('/a.md', {
      text: '# A, edited\n',
      base: '# A\n',
    })
  })

  it('writes only the last text of a burst of edits', () => {
    const { keeper, keep } = setup()
    keeper.track('# A, 1\n', session('/a.md', '# A\n'))
    vi.advanceTimersByTime(300)
    keeper.track('# A, 12\n', session('/a.md', '# A\n'))
    vi.advanceTimersByTime(300)
    expect(keep).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(keep).toHaveBeenCalledTimes(1)
    expect(keep).toHaveBeenCalledWith('/a.md', {
      text: '# A, 12\n',
      base: '# A\n',
    })
  })

  it('drops what was kept once the text is back to the file', () => {
    const { keeper, keep, drop } = setup()
    keeper.track('# A\n', session('/a.md', '# A\n'))
    vi.advanceTimersByTime(400)
    expect(drop).toHaveBeenCalledWith('/a.md')
    expect(keep).not.toHaveBeenCalled()
  })

  it('keeps each file apart: a pending text is never written under another file', () => {
    const { keeper, keep } = setup()
    keeper.track('# A, edited\n', session('/a.md', '# A\n'))
    keeper.track('# B\n', session('/b.md', '# B\n'))
    vi.advanceTimersByTime(400)
    expect(keep).toHaveBeenCalledWith('/a.md', {
      text: '# A, edited\n',
      base: '# A\n',
    })
    expect(keep).toHaveBeenCalledTimes(1)
  })

  it('ignores edits without a file or without a ref', () => {
    const { keeper, keep, drop } = setup()
    keeper.track('Untitled', null)
    keeper.track('Downloaded', { ...session('/a.md', ''), ref: null })
    vi.advanceTimersByTime(1000)
    expect(keep).not.toHaveBeenCalled()
    expect(drop).not.toHaveBeenCalled()
  })

  it('writes everything pending right away on flush', () => {
    const { keeper, keep } = setup()
    keeper.track('# A, edited\n', session('/a.md', '# A\n'))
    keeper.track('# B, edited\n', session('/b.md', '# B\n'))
    keeper.flush()
    expect(keep).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1000)
    expect(keep).toHaveBeenCalledTimes(2)
  })

  it('does nothing on flush when nothing is pending', () => {
    const { keeper, keep, drop } = setup()
    keeper.flush()
    expect(keep).not.toHaveBeenCalled()
    expect(drop).not.toHaveBeenCalled()
  })

  it('discards a pending text for good, and drops what was kept', () => {
    const { keeper, keep, drop } = setup()
    keeper.track('# A, edited\n', session('/a.md', '# A\n'))
    keeper.discard('/a.md')
    vi.advanceTimersByTime(1000)
    keeper.flush()
    expect(keep).not.toHaveBeenCalled()
    expect(drop).toHaveBeenCalledWith('/a.md')
  })

  it('discards only the file asked for', () => {
    const { keeper, keep } = setup()
    keeper.track('# A, edited\n', session('/a.md', '# A\n'))
    keeper.track('# B, edited\n', session('/b.md', '# B\n'))
    keeper.discard('/a.md')
    keeper.flush()
    expect(keep).toHaveBeenCalledTimes(1)
    expect(keep).toHaveBeenCalledWith('/b.md', {
      text: '# B, edited\n',
      base: '# B\n',
    })
  })
})
