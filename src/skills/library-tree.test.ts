import { describe, expect, it } from 'vitest'
import { createFakeFileSystem, link } from './fake-file-system'
import type { LibraryListing, LibraryRoot } from './library'
import {
  ancestorIds,
  buildLibraryTree,
  openFileId,
  type TreeNode,
  visibleItems,
} from './library-tree'
import { type Skill, type SkillFile, scanSkillRoots } from './scan-skills'

const file = (path: string, name: string): SkillFile => ({
  path,
  name,
  isMarkdown: name.toLowerCase().endsWith('.md'),
})

const skill = (
  folderName: string,
  names: readonly string[] = ['SKILL.md'],
  overrides: Partial<Skill> = {},
): Skill => ({
  realPath: `/skills/${folderName}`,
  folderName,
  root: '/skills',
  name: folderName,
  description: undefined,
  problem: undefined,
  files: names.map((name) => file(`/skills/${folderName}/${name}`, name)),
  ...overrides,
})

const root = (
  skills: readonly Skill[],
  overrides: Partial<LibraryRoot> = {},
): LibraryRoot => ({
  root: '/skills',
  label: '~/.claude/skills',
  removable: false,
  readable: true,
  skills,
  ...overrides,
})

const names = (nodes: readonly TreeNode[]): readonly string[] =>
  nodes.map(({ name }) => name)

describe('buildLibraryTree', () => {
  it('makes a node per root, with its Skills as children', () => {
    const tree = buildLibraryTree([root([skill('git'), skill('pdf')])])
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ kind: 'root', name: '~/.claude/skills' })
    expect(names(tree[0]?.children ?? [])).toEqual(['git', 'pdf'])
    expect(tree[0]?.children.map(({ kind }) => kind)).toEqual([
      'skill',
      'skill',
    ])
  })

  it('keeps the Skill name, description and frontmatter problem', () => {
    const problem = {
      rule: 'frontmatter-not-closed' as const,
      message: 'bad',
    }
    const tree = buildLibraryTree([
      root([
        skill('git', ['SKILL.md'], {
          name: 'Git helper',
          description: 'Commits',
          problem,
        }),
      ]),
    ])
    expect(tree[0]?.children[0]).toMatchObject({
      name: 'Git helper',
      description: 'Commits',
      problem,
    })
  })

  it('nests files in folders by their path inside the Skill', () => {
    const tree = buildLibraryTree([
      root([
        skill('pdf', [
          'SKILL.md',
          'references/forms.md',
          'references/deep/more.md',
          'run.sh',
        ]),
      ]),
    ])
    const [pdf] = tree[0]?.children ?? []
    expect(names(pdf?.children ?? [])).toEqual([
      'SKILL.md',
      'references',
      'run.sh',
    ])
    const references = pdf?.children[1]
    expect(references?.kind).toBe('folder')
    expect(names(references?.children ?? [])).toEqual(['forms.md', 'deep'])
    expect(names(references?.children[1]?.children ?? [])).toEqual(['more.md'])
  })

  it('keeps files as leaves with their path and whether they open', () => {
    const tree = buildLibraryTree([
      root([skill('pdf', ['SKILL.md', 'run.sh'])]),
    ])
    const [skillMd, runSh] = tree[0]?.children[0]?.children ?? []
    expect(skillMd).toMatchObject({
      kind: 'file',
      path: '/skills/pdf/SKILL.md',
      openable: true,
      children: [],
    })
    expect(runSh).toMatchObject({ kind: 'file', openable: false })
  })

  it('folds evals/ into one folder labelled with its Eval count', () => {
    const tree = buildLibraryTree([
      root([
        skill('pdf', [
          'SKILL.md',
          'evals/one/prompt.md',
          'evals/one/graders/a.md',
          'evals/two/prompt.md',
          'evals/two/graders/b.md',
        ]),
      ]),
    ])
    const evals = tree[0]?.children[0]?.children[1]
    expect(evals).toMatchObject({
      kind: 'folder',
      name: 'evals',
      detail: '2 Evals',
    })
    expect(names(evals?.children ?? [])).toEqual(['one', 'two'])
  })

  it('says "1 Eval" for one and nothing for none', () => {
    const one = buildLibraryTree([
      root([skill('a', ['SKILL.md', 'evals/x/prompt.md'])]),
    ])
    expect(one[0]?.children[0]?.children[1]?.detail).toBe('1 Eval')
    const none = buildLibraryTree([
      root([skill('a', ['SKILL.md', 'evals/notes.md'])]),
    ])
    expect(none[0]?.children[0]?.children[1]?.detail).toBeUndefined()
  })

  it('labels only the evals/ at the top of a Skill', () => {
    const tree = buildLibraryTree([
      root([skill('a', ['SKILL.md', 'refs/evals/x/prompt.md'])]),
    ])
    expect(
      tree[0]?.children[0]?.children[1]?.children[0]?.detail,
    ).toBeUndefined()
  })

  it('shows a Skill reached through a link and through its target once', async () => {
    const real = '/agents/shared'
    const scans = await scanSkillRoots(
      createFakeFileSystem({
        [`${real}/SKILL.md`]: '---\nname: shared\n---\n',
        '/claude/shared': link(real),
      }),
      ['/claude', '/agents'],
    )
    const tree = buildLibraryTree(
      scans.map((scan) => ({ ...scan, label: scan.root, removable: false })),
    )
    expect(tree.flatMap(({ children }) => names(children))).toEqual(['shared'])
  })

  it('does not count an Eval whose prompt.md is a link', async () => {
    const scans = await scanSkillRoots(
      createFakeFileSystem({
        '/s/a/SKILL.md': '---\nname: a\n---\n',
        '/s/a/evals/one/prompt.md': 'p',
        '/s/a/evals/two/prompt.md': link('/elsewhere/prompt.md'),
        '/elsewhere/prompt.md': 'p',
      }),
      ['/s'],
    )
    const tree = buildLibraryTree(
      scans.map((scan) => ({ ...scan, label: scan.root, removable: false })),
    )
    const evals = tree[0]?.children[0]?.children.find(
      ({ name }) => name === 'evals',
    )
    expect(evals?.detail).toBe('1 Eval')
  })

  it('keeps unreadable and empty roots with the note shown today', () => {
    const tree = buildLibraryTree([
      root([], { readable: false, root: '/gone' }),
      root([], { root: '/empty' }),
    ])
    expect(tree[0]).toMatchObject({
      kind: 'root',
      note: 'Folder not found or not readable',
      children: [],
    })
    expect(tree[1]).toMatchObject({ note: 'No skills here', children: [] })
  })

  it('carries removable and the Skill count on a root', () => {
    const tree = buildLibraryTree([
      root([skill('a'), skill('b')], { removable: true }),
    ])
    expect(tree[0]).toMatchObject({ removable: true, detail: '2' })
  })

  it('gives every node a unique id', () => {
    const tree = buildLibraryTree([
      root([
        skill('a', ['SKILL.md', 'x/y.md']),
        skill('b', ['SKILL.md', 'x/y.md']),
      ]),
    ])
    const ids = visibleItems(tree, () => true).map(({ node }) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(1 + 2 + 2 * 3)
  })
})

describe('visibleItems', () => {
  const tree = buildLibraryTree([
    root([skill('a', ['SKILL.md', 'refs/x.md']), skill('b')]),
  ])
  const [rootNode] = tree
  const [a] = rootNode?.children ?? []

  it('lists only nodes whose ancestors are all expanded, with levels', () => {
    const items = visibleItems(tree, (node) => node.kind === 'root')
    expect(items.map(({ node: { name }, level }) => [name, level])).toEqual([
      ['~/.claude/skills', 1],
      ['a', 2],
      ['b', 2],
    ])
  })

  it('opens a Skill and a folder inside it when asked', () => {
    const items = visibleItems(
      tree,
      (node) =>
        node.kind === 'root' || node.id === a?.id || node.kind === 'folder',
    )
    expect(items.map(({ node: { name } }) => name)).toEqual([
      '~/.claude/skills',
      'a',
      'SKILL.md',
      'refs',
      'x.md',
      'b',
    ])
  })

  it('records the parent and whether a node is open', () => {
    const items = visibleItems(tree, (node) => node.kind === 'root')
    expect(items[0]).toMatchObject({
      parentId: null,
      expandable: true,
      expanded: true,
    })
    expect(items[1]).toMatchObject({
      parentId: rootNode?.id,
      expandable: true,
      expanded: false,
    })
    expect(items[2]).toMatchObject({ expandable: true })
  })

  it('does not call a leaf or an empty root expandable', () => {
    const empty = buildLibraryTree([root([])])
    expect(visibleItems(empty, () => true)[0]).toMatchObject({
      expandable: false,
      expanded: false,
    })
  })
})

describe('ancestorIds', () => {
  const listing: LibraryListing = [
    root([skill('a', ['SKILL.md', 'evals/x/prompt.md']), skill('b')]),
  ]
  const tree = buildLibraryTree(listing)

  it('lists the nodes that hold the open file, outermost first', () => {
    const ids = ancestorIds(
      tree,
      (path) => path === '/skills/a/evals/x/prompt.md',
    )
    const items = visibleItems(tree, (node) => ids.includes(node.id))
    expect(items.map(({ node: { name } }) => name)).toEqual([
      '~/.claude/skills',
      'a',
      'SKILL.md',
      'evals',
      'x',
      'prompt.md',
      'b',
    ])
    expect(ids).toHaveLength(4)
  })

  it('is empty when no file matches', () => {
    expect(ancestorIds(tree, () => false)).toEqual([])
  })
})

describe('openFileId', () => {
  const tree = buildLibraryTree([
    root([skill('a', ['SKILL.md', 'refs/x.md']), skill('b')]),
  ])

  it('is the id of the file node that is open, even in a folded folder', () => {
    const id = openFileId(tree, (path) => path === '/skills/a/refs/x.md')
    expect(id).toBe('skill:/skills/a/refs/x.md')
  })

  it('is undefined when no file is open', () => {
    expect(openFileId(tree, () => false)).toBeUndefined()
  })
})
