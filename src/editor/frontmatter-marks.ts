import { findFrontmatter } from '../blocks/frontmatter'

export type FrontmatterMark =
  | {
      readonly kind: 'line'
      readonly from: number
      readonly role: 'delimiter' | 'body'
    }
  | { readonly kind: 'key'; readonly from: number; readonly to: number }

const TOP_LEVEL_KEY =
  /^(?:[\p{L}\p{N}_.-]+|"[^"]*"|'[^']*')(?=[ \t]*:(?:[ \t]|$))/u

const marksOfLine = (
  line: string,
  from: number,
  role: 'delimiter' | 'body',
): readonly FrontmatterMark[] => {
  const key = role === 'body' ? TOP_LEVEL_KEY.exec(line) : null
  return [
    { kind: 'line', from, role },
    ...(key === null
      ? []
      : [{ kind: 'key' as const, from, to: from + key[0].length }]),
  ]
}

export const frontmatterMarks = (text: string): readonly FrontmatterMark[] => {
  const frontmatter = findFrontmatter(text)
  if (frontmatter === undefined) return []
  const lines = text.slice(0, frontmatter.to).split('\n')
  return lines.flatMap((line, index) =>
    marksOfLine(
      line,
      lines
        .slice(0, index)
        .reduce((offset, previous) => offset + previous.length + 1, 0),
      index === 0 || index === lines.length - 1 ? 'delimiter' : 'body',
    ),
  )
}
