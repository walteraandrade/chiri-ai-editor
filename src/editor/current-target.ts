import type { EditorState, Text } from '@codemirror/state'
import { type Block, extractBlocks } from '../blocks/extract-blocks'
import { type Frontmatter, findFrontmatter } from '../blocks/frontmatter'
import { resolveTarget, type Target } from '../blocks/target'

const textCache = new WeakMap<Text, string>()
const blockCache = new WeakMap<Text, readonly Block[]>()

export const textOfDoc = (doc: Text): string => {
  const cached = textCache.get(doc)
  if (cached !== undefined) return cached
  const text = doc.toString()
  textCache.set(doc, text)
  return text
}

export const textOf = (state: EditorState): string => textOfDoc(state.doc)

export const frontmatterOfDoc = (doc: Text): Frontmatter | undefined =>
  doc.line(1).text.startsWith('---')
    ? findFrontmatter(textOfDoc(doc))
    : undefined

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
