import { describe, expect, it } from 'vitest'
import { createLaunchQueue, launchFileOf } from './launch-queue'

const EXE = '/opt/Desafinado/desafinado'

describe('launchFileOf', () => {
  it('finds the Markdown file the desktop passes', () => {
    expect(launchFileOf([EXE, '/home/w/notes/today.md'], '/')).toBe(
      '/home/w/notes/today.md',
    )
  })

  it('turns a file URL into its path', () => {
    expect(launchFileOf([EXE, 'file:///home/w/my%20notes/a.md'], '/')).toBe(
      '/home/w/my notes/a.md',
    )
  })

  it('resolves a relative path against the working directory', () => {
    expect(launchFileOf([EXE, 'docs/README.md'], '/home/w/repo')).toBe(
      '/home/w/repo/docs/README.md',
    )
    expect(launchFileOf([EXE, '../a.markdown'], '/home/w/repo')).toBe(
      '/home/w/a.markdown',
    )
  })

  it('skips switches, the dev entry and files that are not Markdown', () => {
    expect(
      launchFileOf(
        [EXE, '--enable-features=UseOzonePlatform', '.', 'run.sh', 'b.MD'],
        '/w',
      ),
    ).toBe('/w/b.MD')
  })

  it('never reads the executable as the file', () => {
    expect(launchFileOf(['/tmp/odd.md'], '/')).toBeNull()
  })

  it.each([
    ['no arguments', [EXE]],
    ['a web URL', [EXE, 'https://example.com/a.md']],
    ['a broken file URL', [EXE, 'file://host/a.md']],
    ['only a folder', [EXE, '/home/w/notes']],
  ])('finds nothing with %s', (_label, argv) => {
    expect(launchFileOf(argv, '/')).toBeNull()
  })
})

describe('createLaunchQueue', () => {
  const identity = async (path: string) => path

  it('gives the offered file once, by its real path', async () => {
    const queue = createLaunchQueue({
      realPath: async (path) => path.replace('/link/', '/real/'),
    })
    expect(queue.offer([EXE, '/link/a.md'], '/')).toBe(true)
    expect(await queue.take()).toBe('/real/a.md')
    expect(await queue.take()).toBeNull()
  })

  it('keeps the path as given when the real path cannot be read', async () => {
    const queue = createLaunchQueue({
      realPath: async () => {
        throw new Error('ENOENT')
      },
    })
    queue.offer([EXE, '/gone/a.md'], '/')
    expect(await queue.take()).toBe('/gone/a.md')
  })

  it('keeps what is waiting when a launch brings no file', async () => {
    const queue = createLaunchQueue({ realPath: identity })
    queue.offer([EXE, '/a.md'], '/')
    expect(queue.offer([EXE], '/')).toBe(false)
    expect(await queue.take()).toBe('/a.md')
  })

  it('lets a newer launch replace one nobody took', async () => {
    const queue = createLaunchQueue({ realPath: identity })
    queue.offer([EXE, '/a.md'], '/')
    queue.offer([EXE, '/b.md'], '/')
    expect(await queue.take()).toBe('/b.md')
  })

  it('starts empty', async () => {
    expect(await createLaunchQueue({ realPath: identity }).take()).toBeNull()
  })
})
