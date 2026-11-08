import { describe, expect, it } from 'vitest'
import type { TreeItem, TreeNode } from './library-tree'
import { type TreeKeyEvent, treeKey } from './tree-keys'

const node = (
  id: string,
  kind: TreeNode['kind'],
  name: string,
  overrides: Partial<TreeNode> = {},
): TreeNode => ({ id, kind, name, children: [], ...overrides })

const item = (
  id: string,
  kind: TreeNode['kind'],
  name: string,
  level: number,
  parentId: string | null,
  state: { expandable?: boolean; expanded?: boolean } & Partial<TreeNode> = {},
): TreeItem => {
  const { expandable = false, expanded = false, ...overrides } = state
  return {
    node: node(id, kind, name, overrides),
    level,
    parentId,
    expandable,
    expanded,
  }
}

const ITEMS: readonly TreeItem[] = [
  item('r', 'root', 'Personal', 1, null, {
    expandable: true,
    expanded: true,
    removable: true,
  }),
  item('s1', 'skill', 'alpha', 2, 'r', { expandable: true, expanded: true }),
  item('f1', 'file', 'SKILL.md', 3, 's1', { openable: true }),
  item('f2', 'file', 'run.sh', 3, 's1', { openable: false }),
  item('s2', 'skill', 'beta', 2, 'r', { expandable: true }),
  item('s3', 'skill', 'bravo', 2, 'r', { expandable: true }),
  item('r2', 'root', 'Project', 1, null, { expandable: false }),
]

const press = (
  key: string,
  focusedId: string | null,
  typed = '',
  modifiers: Partial<TreeKeyEvent> = {},
) => treeKey(ITEMS, focusedId, { key, ...modifiers }, typed)

describe('arrows over the visible items', () => {
  it('ArrowDown goes to the next item', () => {
    expect(press('ArrowDown', 's1').action).toEqual({ kind: 'focus', id: 'f1' })
  })

  it('ArrowUp goes to the previous item', () => {
    expect(press('ArrowUp', 'f1').action).toEqual({ kind: 'focus', id: 's1' })
  })

  it('stops at the ends', () => {
    expect(press('ArrowUp', 'r').action).toEqual({ kind: 'none' })
    expect(press('ArrowDown', 'r2').action).toEqual({ kind: 'none' })
  })

  it('Home and End go to the first and last item', () => {
    expect(press('Home', 's3').action).toEqual({ kind: 'focus', id: 'r' })
    expect(press('End', 'r').action).toEqual({ kind: 'focus', id: 'r2' })
  })

  it('starts from the first item when nothing is focused', () => {
    expect(press('ArrowDown', null).action).toEqual({ kind: 'focus', id: 'r' })
    expect(press('ArrowUp', null).action).toEqual({ kind: 'focus', id: 'r' })
  })

  it('does nothing in an empty tree', () => {
    expect(treeKey([], null, { key: 'ArrowDown' }, '').action).toEqual({
      kind: 'none',
    })
  })
})

describe('ArrowRight', () => {
  it('unfolds a folded node', () => {
    expect(press('ArrowRight', 's2').action).toEqual({
      kind: 'toggle',
      id: 's2',
      expand: true,
    })
  })

  it('moves to the first child of an unfolded node', () => {
    expect(press('ArrowRight', 's1').action).toEqual({
      kind: 'focus',
      id: 'f1',
    })
  })

  it('does nothing on a file or a node with no children', () => {
    expect(press('ArrowRight', 'f1').action).toEqual({ kind: 'none' })
    expect(press('ArrowRight', 'r2').action).toEqual({ kind: 'none' })
  })
})

describe('ArrowLeft', () => {
  it('folds an unfolded node', () => {
    expect(press('ArrowLeft', 's1').action).toEqual({
      kind: 'toggle',
      id: 's1',
      expand: false,
    })
  })

  it('moves a file or folded node to its parent', () => {
    expect(press('ArrowLeft', 'f1').action).toEqual({ kind: 'focus', id: 's1' })
    expect(press('ArrowLeft', 's2').action).toEqual({ kind: 'focus', id: 'r' })
  })

  it('does nothing on a top-level node that is folded', () => {
    expect(press('ArrowLeft', 'r2').action).toEqual({ kind: 'none' })
  })
})

describe('Enter and Space', () => {
  it('Enter opens a Markdown file and puts the cursor in the text', () => {
    expect(press('Enter', 'f1').action).toEqual({
      kind: 'open',
      id: 'f1',
      focusText: true,
    })
  })

  it('Space opens it and keeps the focus in the tree', () => {
    expect(press(' ', 'f1').action).toEqual({
      kind: 'open',
      id: 'f1',
      focusText: false,
    })
  })

  it('does not open a file that is not Markdown', () => {
    expect(press('Enter', 'f2').action).toEqual({ kind: 'none' })
    expect(press(' ', 'f2').action).toEqual({ kind: 'none' })
  })

  it('folds or unfolds a node', () => {
    expect(press('Enter', 's1').action).toEqual({
      kind: 'toggle',
      id: 's1',
      expand: false,
    })
    expect(press(' ', 's2').action).toEqual({
      kind: 'toggle',
      id: 's2',
      expand: true,
    })
  })

  it('does nothing on a node with no children', () => {
    expect(press('Enter', 'r2').action).toEqual({ kind: 'none' })
  })
})

describe('Delete', () => {
  it('removes a root that can be removed', () => {
    expect(press('Delete', 'r').action).toEqual({ kind: 'remove', id: 'r' })
  })

  it('does nothing on a root that cannot be removed', () => {
    expect(press('Delete', 'r2').action).toEqual({ kind: 'none' })
  })

  it('does nothing on a Skill or a file', () => {
    expect(press('Delete', 's1').action).toEqual({ kind: 'none' })
    expect(press('Delete', 'f1').action).toEqual({ kind: 'none' })
  })
})

describe('type-ahead', () => {
  it('moves to the next item whose name starts with the letter', () => {
    const result = press('b', 'r')
    expect(result.action).toEqual({ kind: 'focus', id: 's2' })
    expect(result.typed).toBe('b')
  })

  it('is case-insensitive', () => {
    expect(press('A', 'r').action).toEqual({ kind: 'focus', id: 's1' })
  })

  it('repeating one letter cycles through the matches', () => {
    expect(press('b', 's2', 'b').action).toEqual({ kind: 'focus', id: 's3' })
    expect(press('b', 's3', 'bb').action).toEqual({ kind: 'focus', id: 's2' })
  })

  it('more letters narrow the match, starting at the focused item', () => {
    const result = press('r', 's2', 'b')
    expect(result.action).toEqual({ kind: 'focus', id: 's3' })
    expect(result.typed).toBe('br')
  })

  it('keeps the focus when nothing matches', () => {
    expect(press('z', 's1').action).toEqual({ kind: 'none' })
  })

  it('Space is a letter while a word is being typed', () => {
    const result = press(' ', 's2', 'be')
    expect(result.action).toEqual({ kind: 'none' })
    expect(result.typed).toBe('be ')
  })

  it('ignores keys with Ctrl, Meta or Alt', () => {
    expect(press('b', 'r', '', { ctrlKey: true }).action).toEqual({
      kind: 'none',
    })
    expect(press('b', 'r', '', { metaKey: true }).action).toEqual({
      kind: 'none',
    })
  })

  it('leaves the buffer empty after a navigation key', () => {
    expect(press('ArrowDown', 'r', 'be').typed).toBe('')
  })

  it('ignores other named keys', () => {
    expect(press('Tab', 'r').action).toEqual({ kind: 'none' })
    expect(press('Escape', 'r').action).toEqual({ kind: 'none' })
  })
})
