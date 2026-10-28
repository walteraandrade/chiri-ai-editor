import type { EditorState, Text } from '@codemirror/state'
import { type Block, extractBlocks } from '../blocks/extract-blocks'
import { resolveTarget, type Target } from '../blocks/target'

const textCache = new WeakMap<Text, string>()
const blockCache = new WeakMap<Text, readonly Block[]>()

export const textOf = (state: EditorState): string => {
  const cached = textCache.get(state.doc)
  if (cached !== undefined) return cached
  const text = state.doc.toString()
  textCache.set(state.doc, text)
  return text
}

export const blocksOf = (state: EditorState): readonly Block[] => {
  const cached = blockCache.get(state.doc)
  if (cached) return cached
  const blocks = extractBlocks(textOf(state))
  blockCache.set(state.doc, blocks)
  return blocks
}

export const currentTarget = (state: EditorState): Target | undefined => {
  const { from, to } = state.selection.main
  return resolveTarget(blocksOf(state), textOf(state), { from, to })
}
