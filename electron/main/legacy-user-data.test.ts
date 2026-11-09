import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyUserData } from './legacy-user-data'

let appData = ''

beforeEach(async () => {
  appData = await mkdtemp(join(tmpdir(), 'desafinado-app-data-'))
})

afterEach(async () => {
  await rm(appData, { recursive: true, force: true })
})

const seed = async (folder: string, files: Record<string, string>) => {
  for (const [name, text] of Object.entries(files)) {
    await mkdir(join(appData, folder, name, '..'), { recursive: true })
    await writeFile(join(appData, folder, name), text)
  }
}

const target = () => join(appData, 'desafinado')

describe('migrateLegacyUserData', () => {
  it('copies the old dev folder into the new one', async () => {
    await seed('chiri-ai-editor', {
      'history.sqlite': 'h',
      'Local Storage/leveldb/000003.log': 'l',
    })
    expect(migrateLegacyUserData({ target: target(), appData })).toBe(
      join(appData, 'chiri-ai-editor'),
    )
    expect(await readFile(join(target(), 'history.sqlite'), 'utf8')).toBe('h')
    expect(
      await readFile(
        join(target(), 'Local Storage/leveldb/000003.log'),
        'utf8',
      ),
    ).toBe('l')
  })

  it('copies the old packaged folder when there is no dev folder', async () => {
    await seed('Chiri', { 'quick-actions.json': '[]' })
    migrateLegacyUserData({ target: target(), appData })
    expect(existsSync(join(target(), 'quick-actions.json'))).toBe(true)
  })

  it('keeps the old folder', async () => {
    await seed('chiri-ai-editor', { 'history.sqlite': 'h' })
    migrateLegacyUserData({ target: target(), appData })
    expect(existsSync(join(appData, 'chiri-ai-editor', 'history.sqlite'))).toBe(
      true,
    )
  })

  it('skips caches and the old instance lock', async () => {
    await seed('chiri-ai-editor', {
      'history.sqlite': 'h',
      SingletonLock: 'x',
      'Cache/data': 'x',
      'GPUCache/data': 'x',
    })
    migrateLegacyUserData({ target: target(), appData })
    expect(existsSync(join(target(), 'SingletonLock'))).toBe(false)
    expect(existsSync(join(target(), 'Cache'))).toBe(false)
    expect(existsSync(join(target(), 'GPUCache'))).toBe(false)
  })

  it('does nothing once the new folder holds app data', async () => {
    await seed('chiri-ai-editor', { 'history.sqlite': 'old' })
    await seed('desafinado', { 'history.sqlite': 'new' })
    expect(migrateLegacyUserData({ target: target(), appData })).toBe(undefined)
    expect(await readFile(join(target(), 'history.sqlite'), 'utf8')).toBe('new')
  })

  it('still copies when the new folder only holds Chromium files', async () => {
    await seed('chiri-ai-editor', { 'history.sqlite': 'h' })
    await seed('desafinado', { 'Crashpad/settings.dat': 'c' })
    migrateLegacyUserData({ target: target(), appData })
    expect(existsSync(join(target(), 'history.sqlite'))).toBe(true)
  })

  it('does nothing without an old folder', () => {
    expect(migrateLegacyUserData({ target: target(), appData })).toBe(undefined)
    expect(existsSync(target())).toBe(false)
  })
})
