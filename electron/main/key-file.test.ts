import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createKeyFile } from './key-file'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'desafinado-key-file-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('createKeyFile', () => {
  it('reads null when the file does not exist', async () => {
    expect(await createKeyFile(join(dir, 'key.json')).read()).toBeNull()
  })

  it('writes and reads back, creating the folder', async () => {
    const file = createKeyFile(join(dir, 'nested', 'key.json'))
    await file.write('{"a":1}')
    expect(await file.read()).toBe('{"a":1}')
  })

  it('keeps the file readable by its owner only', async () => {
    const path = join(dir, 'key.json')
    await createKeyFile(path).write('x')
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  it('replaces the content and leaves no temporary file behind', async () => {
    const path = join(dir, 'key.json')
    const file = createKeyFile(path)
    await file.write('one')
    await file.write('two')
    expect(await file.read()).toBe('two')
    const { readdir } = await import('node:fs/promises')
    expect(await readdir(dir)).toEqual(['key.json'])
  })

  it('removes the file, and removing twice is fine', async () => {
    const file = createKeyFile(join(dir, 'key.json'))
    await file.write('x')
    await file.remove()
    await file.remove()
    expect(await file.read()).toBeNull()
  })
})
