import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRootsStore, ROOTS_FILE_NAME } from './roots-store'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chiri-roots-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('createRootsStore', () => {
  it('has no project roots before anything is saved', async () => {
    expect(await createRootsStore(dir).load()).toEqual([])
  })

  it('keeps the project roots in a file in the user data folder', async () => {
    await createRootsStore(dir).save(['/repo/.claude/skills'])
    expect(
      JSON.parse(await readFile(join(dir, ROOTS_FILE_NAME), 'utf8')),
    ).toEqual({ projectRoots: ['/repo/.claude/skills'] })
  })

  it('gives back what an earlier store saved, as after a restart', async () => {
    await createRootsStore(dir).save(['/a', '/b'])
    expect(await createRootsStore(dir).load()).toEqual(['/a', '/b'])
  })

  it('starts empty when the file is damaged', async () => {
    await writeFile(join(dir, ROOTS_FILE_NAME), '{ not json')
    expect(await createRootsStore(dir).load()).toEqual([])
  })

  it('replaces the roots on the next save', async () => {
    const store = createRootsStore(dir)
    await store.save(['/a', '/b'])
    await store.save(['/b'])
    expect(await store.load()).toEqual(['/b'])
  })
})
