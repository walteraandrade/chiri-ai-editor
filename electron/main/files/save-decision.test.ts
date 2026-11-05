import { describe, expect, it } from 'vitest'
import { decideSave } from './save-decision'

describe('decideSave', () => {
  it('writes when the disk holds the text last read or written', () => {
    expect(decideSave('# A\n', '# A\n')).toBe('write')
  })

  it('stops when the disk text differs', () => {
    expect(decideSave('# A, changed elsewhere\n', '# A\n')).toBe('conflict')
  })

  it('stops when the disk text could not be read as text', () => {
    expect(decideSave(null, '# A\n')).toBe('conflict')
  })

  it('compares like with like: CRLF and a byte order mark are not a change', () => {
    const bom = String.fromCharCode(0xfeff)
    expect(decideSave(`${bom}# A\r\n\r\nB\r\n`, '# A\n\nB\n')).toBe('write')
  })

  it('sees a change in the last character', () => {
    expect(decideSave('# A\n', '# A')).toBe('conflict')
  })

  it('treats an empty file like any other text', () => {
    expect(decideSave('', '')).toBe('write')
    expect(decideSave('', '# A\n')).toBe('conflict')
  })
})
