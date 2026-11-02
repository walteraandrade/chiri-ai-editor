const MARKDOWN_EXTENSION = /\.(md|markdown)$/i

export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_EXTENSION.test(path)

export const withMarkdownExtension = (path: string): string =>
  isMarkdownPath(path) ? path : `${path}.md`
