export type Frontmatter = {
  readonly from: number
  readonly to: number
  readonly yamlFrom: number
  readonly yamlTo: number
}

type Range = {
  readonly from: number
  readonly to: number
}

const FRONTMATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?=\n|$)/

const MAPPING_KEY = /^(?:[\p{L}\p{N}_.-]+|"[^"]*"|'[^']*')[ \t]*:(?:[ \t]|$)/u

const looksLikeYaml = (yaml: string): boolean => {
  if (yaml.trim() === '') return true
  const first = yaml
    .split('\n')
    .find((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  return first !== undefined && MAPPING_KEY.test(first)
}

export const findFrontmatter = (text: string): Frontmatter | undefined => {
  if (!text.startsWith('---')) return undefined
  const match = FRONTMATTER.exec(text)
  if (match === null || !looksLikeYaml(match[1] ?? '')) return undefined
  const yamlFrom = text.indexOf('\n') + 1
  return {
    from: 0,
    to: match[0].length,
    yamlFrom,
    yamlTo: yamlFrom + (match[1]?.length ?? 0),
  }
}

export const touchesFrontmatter = (
  frontmatter: Frontmatter | undefined,
  { from, to }: Range,
): boolean =>
  frontmatter !== undefined &&
  (from < frontmatter.to || (from === to && from === frontmatter.to))

export const blankFrontmatter = (text: string): string => {
  const frontmatter = findFrontmatter(text)
  return frontmatter === undefined
    ? text
    : ' '.repeat(frontmatter.to) + text.slice(frontmatter.to)
}
