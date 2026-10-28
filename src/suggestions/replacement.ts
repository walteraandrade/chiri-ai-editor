const leadingWhitespace = (text: string): string => /^\s*/.exec(text)?.[0] ?? ''

const trailingWhitespace = (text: string): string =>
  text.trim() === '' ? '' : (/\s*$/.exec(text)?.[0] ?? '')

export const matchEdgeWhitespace = (
  original: string,
  replacement: string,
): string =>
  `${leadingWhitespace(original)}${replacement.trim()}${trailingWhitespace(original)}`
