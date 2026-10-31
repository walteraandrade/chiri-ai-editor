import { extractBlocks } from '../blocks/extract-blocks'
import { headingText } from '../blocks/target'

export const DEFAULT_FILE_NAME = 'document.md'
export const MARKDOWN_ACCEPT = '.md,.markdown,text/markdown'

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)
const MAX_SLUG_LENGTH = 60

export const decodeMarkdown = (text: string): string =>
  (text.startsWith(BYTE_ORDER_MARK)
    ? text.slice(BYTE_ORDER_MARK.length)
    : text
  ).replace(/\r\n?/g, '\n')

const slugOf = (title: string): string =>
  title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '')

export const suggestedFileName = (doc: string): string => {
  const title = extractBlocks(doc).find(
    (block) => block.kind === 'heading' && block.level === 1,
  )
  const slug = title ? slugOf(headingText(title)) : ''
  return slug === '' ? DEFAULT_FILE_NAME : `${slug}.md`
}
