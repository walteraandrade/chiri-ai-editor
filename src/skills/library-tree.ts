import type { FrontmatterProblem } from './frontmatter-fields'
import type { LibraryListing, LibraryRoot } from './library'
import type { Skill, SkillFile } from './scan-skills'

export type TreeKind = 'root' | 'skill' | 'folder' | 'file'

export type TreeNode = {
  readonly id: string
  readonly kind: TreeKind
  readonly name: string
  readonly children: readonly TreeNode[]
  readonly path?: string
  readonly openable?: boolean
  readonly removable?: boolean
  readonly detail?: string
  readonly note?: string
  readonly description?: string
  readonly problem?: FrontmatterProblem
}

export type TreeItem = {
  readonly node: TreeNode
  readonly level: number
  readonly parentId: string | null
  readonly expandable: boolean
  readonly expanded: boolean
}

const EVALS_FOLDER = 'evals'
const PROMPT_FILE = 'prompt.md'

const rootId = (root: string): string => `root:${root}`
const skillId = (realPath: string): string => `skill:${realPath}`

type Entry = { readonly file: SkillFile; readonly parts: readonly string[] }

const groupByFirst = (
  entries: readonly Entry[],
): readonly (readonly [string, readonly Entry[]])[] => [
  ...entries
    .reduce((groups, entry) => {
      const head = entry.parts[0] ?? ''
      groups.set(head, [...(groups.get(head) ?? []), entry])
      return groups
    }, new Map<string, readonly Entry[]>())
    .entries(),
]

const evalCount = (folder: TreeNode): number =>
  folder.children.filter(
    ({ kind, children }) =>
      kind === 'folder' &&
      children.some(
        ({ kind: child, name }) => child === 'file' && name === PROMPT_FILE,
      ),
  ).length

const evalDetail = (count: number): string | undefined =>
  count === 0 ? undefined : `${count} ${count === 1 ? 'Eval' : 'Evals'}`

const buildLevel = (
  ownerId: string,
  prefix: string,
  entries: readonly Entry[],
  top: boolean,
): readonly TreeNode[] =>
  groupByFirst(entries).map(([name, group]): TreeNode => {
    const leaf = group.find(({ parts }) => parts.length === 1)
    if (leaf !== undefined && group.length === 1)
      return {
        id: `${ownerId}/${prefix}${name}`,
        kind: 'file',
        name,
        path: leaf.file.path,
        openable: leaf.file.isMarkdown,
        children: [],
      }
    const id = `${ownerId}/${prefix}${name}`
    const folder: TreeNode = {
      id,
      kind: 'folder',
      name,
      children: buildLevel(
        ownerId,
        `${prefix}${name}/`,
        group
          .filter(({ parts }) => parts.length > 1)
          .map(({ file, parts }) => ({ file, parts: parts.slice(1) })),
        false,
      ),
    }
    return top && name === EVALS_FOLDER
      ? { ...folder, detail: evalDetail(evalCount(folder)) }
      : folder
  })

const buildSkill = (skill: Skill): TreeNode => ({
  id: skillId(skill.realPath),
  kind: 'skill',
  name: skill.name,
  path: skill.realPath,
  description: skill.description,
  problem: skill.problem,
  children: buildLevel(
    skillId(skill.realPath),
    '',
    skill.files.map((file) => ({ file, parts: file.name.split('/') })),
    true,
  ),
})

const rootNote = (root: LibraryRoot, skills: readonly Skill[]) =>
  !root.readable
    ? 'Folder not found or not readable'
    : skills.length === 0
      ? 'No skills here'
      : undefined

export const buildLibraryTree = (roots: LibraryListing): readonly TreeNode[] =>
  roots.reduce<{
    readonly seen: ReadonlySet<string>
    readonly nodes: readonly TreeNode[]
  }>(
    ({ seen, nodes }, root) => {
      const skills = root.skills.filter(({ realPath }) => !seen.has(realPath))
      const node: TreeNode = {
        id: rootId(root.root),
        kind: 'root',
        name: root.label,
        path: root.root,
        removable: root.removable,
        detail: root.readable ? String(root.skills.length) : undefined,
        note: rootNote(root, root.skills),
        children: skills.map(buildSkill),
      }
      return {
        seen: new Set([...seen, ...skills.map(({ realPath }) => realPath)]),
        nodes: [...nodes, node],
      }
    },
    { seen: new Set(), nodes: [] },
  ).nodes

const flatten = (
  nodes: readonly TreeNode[],
  isExpanded: (node: TreeNode) => boolean,
  level: number,
  parentId: string | null,
): readonly TreeItem[] =>
  nodes.flatMap((node) => {
    const expandable = node.children.length > 0
    const expanded = expandable && isExpanded(node)
    return [
      { node, level, parentId, expandable, expanded },
      ...(expanded
        ? flatten(node.children, isExpanded, level + 1, node.id)
        : []),
    ]
  })

export const visibleItems = (
  tree: readonly TreeNode[],
  isExpanded: (node: TreeNode) => boolean,
): readonly TreeItem[] => flatten(tree, isExpanded, 1, null)

const pathTo = (
  nodes: readonly TreeNode[],
  isOpenFile: (path: string) => boolean,
): readonly string[] | undefined =>
  nodes.reduce<readonly string[] | undefined>((found, node) => {
    if (found !== undefined) return found
    if (node.kind === 'file')
      return node.path !== undefined && isOpenFile(node.path) ? [] : undefined
    const inside = pathTo(node.children, isOpenFile)
    return inside === undefined ? undefined : [node.id, ...inside]
  }, undefined)

export const ancestorIds = (
  tree: readonly TreeNode[],
  isOpenFile: (path: string) => boolean,
): readonly string[] => pathTo(tree, isOpenFile) ?? []

export const openFileId = (
  tree: readonly TreeNode[],
  isOpenFile: (path: string) => boolean,
): string | undefined =>
  flatten(tree, () => true, 1, null).find(
    ({ node }) =>
      node.kind === 'file' && node.path !== undefined && isOpenFile(node.path),
  )?.node.id
