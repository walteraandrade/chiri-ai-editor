import { type ArrayChange, diffArrays } from 'diff'

export type LineRun =
  | { readonly kind: 'same'; readonly lines: readonly string[] }
  | {
      readonly kind: 'changed'
      readonly removed: string
      readonly added: string
    }

type Part = ArrayChange<string>

const linesOf = (text: string): string[] => text.replace(/\n+$/, '').split('\n')

const joined = (part: Part | undefined): string => part?.value.join('\n') ?? ''

export const lineRuns = (before: string, after: string): readonly LineRun[] => {
  const parts = diffArrays(linesOf(before), linesOf(after))
  return parts.flatMap((part, index): readonly LineRun[] => {
    if (!part.added && !part.removed)
      return [{ kind: 'same', lines: part.value }]
    if (part.added && parts[index - 1]?.removed) return []
    const next = parts[index + 1]
    const removed = part.removed ? part : undefined
    const added = part.added ? part : next?.added ? next : undefined
    return [{ kind: 'changed', removed: joined(removed), added: joined(added) }]
  })
}
