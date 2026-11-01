import { describe, expect, it } from 'vitest'
import { describeFailure } from './fs-failure'

const errno = (code: string) =>
  Object.assign(new Error(`${code}: details`), { code })

describe('describeFailure', () => {
  it('names the common causes', () => {
    expect(describeFailure(errno('ENOENT'))).toBe('File not found')
    expect(describeFailure(errno('EACCES'))).toBe('Permission denied')
    expect(describeFailure(errno('EPERM'))).toBe('Permission denied')
    expect(describeFailure(errno('EROFS'))).toBe('Read-only file system')
    expect(describeFailure(errno('ENOSPC'))).toBe('No space left on the device')
    expect(describeFailure(errno('EISDIR'))).toBe('Not a file')
  })

  it('does not leak paths or messages for the rest', () => {
    expect(describeFailure(errno('EIO'))).toBe('Could not reach the file')
    expect(describeFailure(new Error('/home/walter/secret'))).toBe(
      'Could not reach the file',
    )
    expect(describeFailure('boom')).toBe('Could not reach the file')
  })
})
