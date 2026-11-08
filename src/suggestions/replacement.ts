const leadingWhitespace = (text: string): string =>
  text.slice(0, text.length - text.trimStart().length)

const trailingWhitespace = (text: string): string =>
  text.trim() === '' ? '' : text.slice(text.trimEnd().length)

export const matchEdgeWhitespace = (
  original: string,
  replacement: string,
): string =>
  `${leadingWhitespace(original)}${replacement.trim()}${trailingWhitespace(original)}`
