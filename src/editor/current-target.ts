import type { EditorState, Text } from '@codemirror/state'
import { type Block, extractBlocks } from '../blocks/extract-blocks'
import { resolveTarget, type Target } from '../blocks/target'

const blockCache = new WeakMap<Text, readonly Block[]>()

export const blocksOf = (state: EditorState): readonly Block[] => {
  const cached = blockCache.get(state.doc)
  if (cached) return cached
  const blocks = extractBlocks(state.doc.toString())
  blockCache.set(state.doc, blocks)
  return blocks
}

export const currentTarget = (state: EditorState): Target | undefined => {
  const { from, to } = state.selection.main
  return resolveTarget(blocksOf(state), state.doc.toString(), { from, to })
}
