import { z } from 'zod'
import { describeVersion } from '../history/story'
import type { VersionList, VersionSummary } from '../history/types'

export type RunBaseline =
  | { readonly kind: 'none' }
  | { readonly kind: 'version'; readonly versionId: number }

export type SummaryBaseline =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'version'
      readonly versionId: number
      readonly at: number
    }

export const NO_BASELINE = { kind: 'none' } as const

const summaryBaselineSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('version'),
    versionId: z.number().int().min(1),
    at: z.number().int().min(0),
  }),
])

export const parseSummaryBaseline = (text: string): SummaryBaseline | null => {
  try {
    const parsed = summaryBaselineSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export const versionOptionLabel = (
  versions: VersionList,
  version: VersionSummary,
  formatTime: (at: number) => string,
): string => {
  const { label, headline } = describeVersion(versions, version, formatTime)
  return `${formatTime(version.at)} · ${label}: ${headline}`
}

export const TODAY_LABEL = "today's SKILL.md"

export const versionLabel = (
  at: number,
  formatTime: (at: number) => string,
): string => `the Version from ${formatTime(at)}`
