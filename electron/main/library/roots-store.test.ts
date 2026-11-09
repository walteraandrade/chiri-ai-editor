import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRootsStore, ROOTS_FILE_NAME } from './roots-store'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'desafinado-roots-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('createRootsStore', () => {
  it('has no project roots before anything is saved', async () => {
    expect(await createRootsStore(dir).load()).toEqual({
      kind: 'loaded',
      roots: [],
    })
  })

  it('keeps the project roots in a file in the user data folder', async () => {
    await createRootsStore(dir).save(['/repo/.claude/skills'])
    expect(
      JSON.parse(await readFile(join(dir, ROOTS_FILE_NAME), 'utf8')),
    ).toEqual({ projectRoots: ['/repo/.claude/skills'] })
  })

  it('gives back what an earlier store saved, as after a restart', async () => {
    await createRootsStore(dir).save(['/a', '/b'])
    expect(await createRootsStore(dir).load()).toEqual({
      kind: 'loaded',
      roots: ['/a', '/b'],
    })
  })

  it.each([
    ['damaged', '{ not json'],
    ['of an unexpected shape', '{"projectRoots":"/repo"}'],
    ['holding a relative path', '{"projectRoots":["repo"]}'],
  ])('is unreadable, not empty, when the file is %s', async (_name, text) => {
    await writeFile(join(dir, ROOTS_FILE_NAME), text)
    expect(await createRootsStore(dir).load()).toEqual({ kind: 'unreadable' })
  })

  it('is unreadable when the path is not a file', async () => {
    await mkdir(join(dir, ROOTS_FILE_NAME))
    expect(await createRootsStore(dir).load()).toEqual({ kind: 'unreadable' })
  })

  it('replaces the roots on the next save', async () => {
    const store = createRootsStore(dir)
    await store.save(['/a', '/b'])
    await store.save(['/b'])
    expect(await store.load()).toEqual({ kind: 'loaded', roots: ['/b'] })
  })
})
