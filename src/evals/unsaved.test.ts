import { describe, expect, it } from 'vitest'
import { filesWithUnsavedText, storedIsUnsaved, unsavedNotice } from './unsaved'

const files = ['SKILL.md', 'evals/a/prompt.md', 'notes.md']

describe('filesWithUnsavedText', () => {
  it('takes the open file from its dirty flag and the others from the store', () => {
    expect(
      filesWithUnsavedText({
        files,
        isOpen: (name) => name === 'SKILL.md',
        openDirty: true,
        stored: new Set(['notes.md']),
      }),
    ).toEqual(['SKILL.md', 'notes.md'])
  })

  it('ignores a stored entry for the open file when it is clean', () => {
    expect(
      filesWithUnsavedText({
        files,
        isOpen: (name) => name === 'SKILL.md',
        openDirty: false,
        stored: new Set(['SKILL.md']),
      }),
    ).toEqual([])
  })
})

describe('unsavedNotice', () => {
  it('is null with nothing unsaved', () => {
    expect(unsavedNotice([])).toBeNull()
  })

  it('names the files and says the run reads the disk', () => {
    expect(unsavedNotice(['SKILL.md'])).toBe(
      'Unsaved text in SKILL.md. A run reads what is saved on disk.',
    )
    expect(unsavedNotice(['a', 'b', 'c', 'd'])).toBe(
      'Unsaved text in a, b and 2 more. A run reads what is saved on disk.',
    )
  })
})

describe('storedIsUnsaved', () => {
  it('is false with nothing stored or text equal to the disk', () => {
    expect(storedIsUnsaved('a', null)).toBe(false)
    expect(storedIsUnsaved('a', { text: 'a', base: 'old' })).toBe(false)
  })

  it('is true when the stored text differs from the disk', () => {
    expect(storedIsUnsaved('a', { text: 'b', base: 'a' })).toBe(true)
  })

  it('is true when the disk cannot be read', () => {
    expect(storedIsUnsaved(null, { text: 'b', base: 'a' })).toBe(true)
  })
})
