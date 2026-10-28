import type { Block } from './extract-blocks'

export type Selection = {
  readonly from: number
  readonly to: number
}

export type Target = {
  readonly source: 'selection' | 'block'
  readonly from: number
  readonly to: number
  readonly text: string
  readonly blocks: readonly Block[]
}

export type Neighbors = {
  readonly title?: string
  readonly section?: string
  readonly before: readonly Block[]
  readonly after: readonly Block[]
}

const NEIGHBOR_COUNT = 2

export const findBlockAt = (
  blocks: readonly Block[],
  position: number,
): Block | undefined =>
  blocks.find((block) => block.from <= position && position <= block.to)

const distanceTo = (block: Block, position: number): number =>
  position < block.from ? block.from - position : position - block.to

const nearestBlock = (
  blocks: readonly Block[],
  position: number,
): Block | undefined =>
  blocks.reduce<Block | undefined>(
    (best, block) =>
      best === undefined ||
      distanceTo(block, position) < distanceTo(best, position)
        ? block
        : best,
    undefined,
  )

export const headingText = (block: Block): string => {
  const lines = block.text.split('\n')
  const content = lines[0]?.startsWith('#')
    ? lines[0].replace(/^#{1,6}[ \t]*/, '').replace(/[ \t]+#+[ \t]*$/, '')
    : lines.slice(0, -1).join(' ')
  return content.trim()
}

const overlaps = (block: Block, from: number, to: number): boolean =>
  block.from < to && block.to > from

const resolveSelectionTarget = (
  blocks: readonly Block[],
  text: string,
  { from, to }: Selection,
): Target | undefined => {
  const selected = text.slice(from, to)
  if (selected.trim() === '') return undefined
  return {
    source: 'selection',
    from,
    to,
    text: selected,
    blocks: blocks.filter((block) => overlaps(block, from, to)),
  }
}

const resolveCursorTarget = (
  blocks: readonly Block[],
  position: number,
): Target | undefined => {
  const block = findBlockAt(blocks, position) ?? nearestBlock(blocks, position)
  return block === undefined
    ? undefined
    : {
        source: 'block',
        from: block.from,
        to: block.to,
        text: block.text,
        blocks: [block],
      }
}

export const resolveTarget = (
  blocks: readonly Block[],
  text: string,
  selection: Selection,
): Target | undefined => {
  const from = Math.max(0, Math.min(selection.from, selection.to))
  const to = Math.min(text.length, Math.max(selection.from, selection.to))
  return from === to
    ? resolveCursorTarget(blocks, from)
    : resolveSelectionTarget(blocks, text, { from, to })
}

const anchorRange = (target: Target): Selection => ({
  from: Math.min(target.from, ...target.blocks.map((block) => block.from)),
  to: Math.max(target.to, ...target.blocks.map((block) => block.to)),
})

export const getNeighbors = (
  blocks: readonly Block[],
  target: Target,
): Neighbors => {
  const { from, to } = anchorRange(target)
  const preceding = blocks.filter((block) => block.to <= from)
  const following = blocks.filter((block) => block.from >= to)
  const title = blocks.find(
    (block) => block.kind === 'heading' && block.level === 1,
  )
  const section = preceding.findLast((block) => block.kind === 'heading')
  return {
    ...(title && { title: headingText(title) }),
    ...(section && { section: headingText(section) }),
    before: preceding.slice(-NEIGHBOR_COUNT),
    after: following.slice(0, NEIGHBOR_COUNT),
  }
}
