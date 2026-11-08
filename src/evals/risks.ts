export type Risk =
  | { readonly kind: 'hooks-frontmatter' }
  | { readonly kind: 'shell-commands'; readonly lines: readonly string[] }
  | { readonly kind: 'left-out'; readonly names: readonly string[] }

export type RiskInput = {
  readonly skillText: string
  readonly leftOut: readonly string[]
}

const MAX_LINES = 5
const MAX_LINE_CHARS = 100

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---/
const HOOKS_FIELD = /^hooks\s*:/m
const SHELL_INLINE = /!`[^`\n]+`/
const SHELL_FENCE = /^\s*```!/

const hasHooksField = (text: string): boolean =>
  HOOKS_FIELD.test(FRONTMATTER.exec(text)?.[1] ?? '')

const runsShell = (line: string): boolean =>
  SHELL_INLINE.test(line) || SHELL_FENCE.test(line)

const clip = (line: string): string =>
  line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line

export const findRisks = ({
  skillText,
  leftOut,
}: RiskInput): readonly Risk[] => {
  const shellLines = skillText
    .split(/\r?\n/)
    .filter(runsShell)
    .map((line) => clip(line.trim()))
    .slice(0, MAX_LINES)
  return [
    ...(hasHooksField(skillText)
      ? [{ kind: 'hooks-frontmatter' } as const]
      : []),
    ...(shellLines.length > 0
      ? [{ kind: 'shell-commands', lines: shellLines } as const]
      : []),
    ...(leftOut.length > 0
      ? [{ kind: 'left-out', names: leftOut } as const]
      : []),
  ]
}

const describeRisk = (risk: Risk): string => {
  switch (risk.kind) {
    case 'hooks-frontmatter':
      return 'SKILL.md has a hooks field. The Stage keeps it, so those hooks can run.'
    case 'shell-commands':
      return `SKILL.md has lines that run shell commands, kept in the Stage: ${risk.lines.join(' | ')}`
    case 'left-out':
      return `The Stage leaves out: ${risk.names.join(', ')}`
  }
}

export const riskLines = (risks: readonly Risk[]): readonly string[] =>
  risks.map(describeRisk)
