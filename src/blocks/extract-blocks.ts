import { markdownLanguage } from '@codemirror/lang-markdown'

export type BlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'blockquote'
  | 'code'
  | 'table'
  | 'html'
  | 'rule'
  | 'other'

export type Block = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly text: string
  readonly kind: BlockKind
  readonly level?: number
}

type MarkdownTree = ReturnType<typeof markdownLanguage.parser.parse>

type Classification = {
  readonly kind: BlockKind
  readonly level?: number
}

const HEADING_NODE = /^(?:ATX|Setext)Heading([1-6])$/

const SIMPLE_KINDS: Readonly<Record<string, BlockKind>> = {
  Paragraph: 'paragraph',
  BulletList: 'list',
  OrderedList: 'list',
  Blockquote: 'blockquote',
  FencedCode: 'code',
  CodeBlock: 'code',
  Table: 'table',
  HTMLBlock: 'html',
  HorizontalRule: 'rule',
}

const classify = (nodeName: string): Classification => {
  const heading = HEADING_NODE.exec(nodeName)
  if (heading?.[1]) return { kind: 'heading', level: Number(heading[1]) }
  return { kind: SIMPLE_KINDS[nodeName] ?? 'other' }
}

export const extractBlocksFromTree = (
  tree: MarkdownTree,
  text: string,
): readonly Block[] => {
  const blocks: Block[] = []
  for (
    let node = tree.topNode.firstChild;
    node !== null;
    node = node.nextSibling
  ) {
    blocks.push({
      id: `p${blocks.length + 1}`,
      from: node.from,
      to: node.to,
      text: text.slice(node.from, node.to),
      ...classify(node.name),
    })
  }
  return blocks
}

export const extractBlocks = (text: string): readonly Block[] =>
  extractBlocksFromTree(markdownLanguage.parser.parse(text), text)
