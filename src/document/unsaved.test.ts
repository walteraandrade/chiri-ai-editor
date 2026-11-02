import { describe, expect, it } from 'vitest'
import { restoreUnsaved } from './unsaved'

describe('restoreUnsaved', () => {
  it('opens the disk text when nothing was kept', () => {
    expect(restoreUnsaved('# A\n', null)).toEqual({
      text: '# A\n',
      savedText: '# A\n',
      restored: false,
      diskChanged: false,
    })
  })

  it('brings back the unsaved text over a file that did not change', () => {
    expect(
      restoreUnsaved('# A\n', { text: '# A, edited\n', base: '# A\n' }),
    ).toEqual({
      text: '# A, edited\n',
      savedText: '# A\n',
      restored: true,
      diskChanged: false,
    })
  })

  it('keeps the text the unsaved edits were based on, so Save sees the change', () => {
    expect(
      restoreUnsaved('# A, by an agent\n', {
        text: '# A, mine\n',
        base: '# A\n',
      }),
    ).toEqual({
      text: '# A, mine\n',
      savedText: '# A\n',
      restored: true,
      diskChanged: true,
    })
  })

  it('drops unsaved text that the disk already holds', () => {
    expect(
      restoreUnsaved('# A, saved\n', { text: '# A, saved\n', base: '# A\n' }),
    ).toEqual({
      text: '# A, saved\n',
      savedText: '# A, saved\n',
      restored: false,
      diskChanged: false,
    })
  })

  it('accepts an empty unsaved text', () => {
    expect(restoreUnsaved('# A\n', { text: '', base: '# A\n' })).toMatchObject({
      text: '',
      restored: true,
    })
  })
})
