import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LibrarySnapshot } from '../../../src/skills/library'
import { scanSkillRoots } from '../../../src/skills/scan-skills'
import type { ExternalChanges } from '../../api'
import { nodeSkillFileSystem } from '../library/node-skill-fs'
import { createExternalChanges } from './external-changes'
import {
  directoryIdentity,
  nodeDirectoryWatch,
  rootEntries,
} from './node-watch'

let base = ''
let stop: () => void = () => undefined

beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'desafinado-external-')))
})

afterEach(async () => {
  stop()
  stop = () => undefined
  await rm(base, { recursive: true, force: true })
})

const skillText = (name: string): string =>
  `---\nname: ${name}\ndescription: About ${name}.\n---\n`

const follow = async (root: string) => {
  const emitted: ExternalChanges[] = []
  const controller = createExternalChanges({
    list: async (): Promise<LibrarySnapshot> => ({
      roots: (await scanSkillRoots(nodeSkillFileSystem, [root])).map(
        (scan) => ({ ...scan, label: scan.root, removable: false }),
      ),
      problem: null,
    }),
    realPath: realpath,
    identityOf: directoryIdentity,
    watch: nodeDirectoryWatch,
    rootEntries,
    emit: (changes) => emitted.push(changes),
    onProblem: () => undefined,
    delayMs: 30,
    maxWaitMs: 200,
  })
  stop = controller.close
  await controller.start()
  return emitted
}

const heard = (emitted: readonly ExternalChanges[], path: string): boolean =>
  emitted.some((changes) => changes.paths.includes(path) && changes.library)

describe('the watcher on a real folder tree', () => {
  it('sees the SKILL.md written some time after the folder was made', async () => {
    const root = join(base, 'skills')
    await mkdir(root)
    const emitted = await follow(root)
    await mkdir(join(root, 'foo'))
    await expect.poll(() => heard(emitted, join(root, 'foo'))).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await writeFile(join(root, 'foo', 'SKILL.md'), skillText('foo'))
    await expect
      .poll(() => heard(emitted, join(root, 'foo', 'SKILL.md')))
      .toBe(true)
  })

  it('sees a skill come back behind a link whose target was removed', async () => {
    const root = join(base, 'skills')
    const target = join(base, 'outside', 'shared')
    await mkdir(root)
    await mkdir(join(base, 'outside'))
    await symlink(target, join(root, 'shared'))
    const emitted = await follow(root)
    await mkdir(target)
    await expect.poll(() => heard(emitted, target)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await writeFile(join(target, 'SKILL.md'), skillText('shared'))
    await expect.poll(() => heard(emitted, join(target, 'SKILL.md'))).toBe(true)
  })

  it('sees a root come back under a hidden folder', async () => {
    const home = join(base, 'home')
    const root = join(home, '.agents', 'skills')
    await mkdir(home)
    const emitted = await follow(root)
    await mkdir(join(home, '.agents'))
    await expect.poll(() => heard(emitted, join(home, '.agents'))).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await mkdir(root)
    await mkdir(join(root, 'foo'))
    await writeFile(join(root, 'foo', 'SKILL.md'), skillText('foo'))
    await expect
      .poll(
        () =>
          heard(emitted, join(root, 'foo', 'SKILL.md')) || heard(emitted, root),
      )
      .toBe(true)
  })
})
