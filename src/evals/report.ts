import { z } from 'zod'

export type Tally = {
  readonly passed: number
  readonly total: number
}

export type CaseTally = {
  readonly name: string
  readonly with: Tally
  readonly without: Tally | null
}

export type EvalSummary = {
  readonly claudeVersion: string
  readonly startedAt: string
  readonly costUsd: number
  readonly cases: readonly CaseTally[]
  readonly with: Tally
  readonly without: Tally | null
}

export type ReportOutcome =
  | { readonly kind: 'complete'; readonly summary: EvalSummary }
  | {
      readonly kind: 'partial'
      readonly reason: string | null
      readonly claudeVersion: string
    }
  | { readonly kind: 'refused'; readonly message: string }

const SUPPORTED_SCHEMA_VERSION = 1

const entry = z.object({ passed: z.boolean() })

const reportSchema = z.object({
  schemaVersion: z.literal(SUPPORTED_SCHEMA_VERSION),
  claudeVersion: z.string(),
  startedAt: z.string(),
  costUsd: z.number(),
  partial: z.boolean(),
  partialReason: z.string().nullish(),
  cases: z.array(
    z.object({
      name: z.string(),
      arms: z.object({
        with: z.array(entry),
        without: z.array(entry).optional(),
      }),
    }),
  ),
})

const envelopeSchema = z.object({
  schemaVersion: z.unknown(),
  claudeVersion: z.string().optional(),
})

const tallyOf = (entries: readonly { readonly passed: boolean }[]): Tally => ({
  passed: entries.filter(({ passed }) => passed).length,
  total: entries.length,
})

const sumTallies = (tallies: readonly Tally[]): Tally => ({
  passed: tallies.reduce((sum, { passed }) => sum + passed, 0),
  total: tallies.reduce((sum, { total }) => sum + total, 0),
})

const versionLabel = (claudeVersion: string | undefined): string =>
  claudeVersion === undefined
    ? 'an unknown Claude CLI version'
    : `Claude CLI ${claudeVersion}`

const refuse = (
  claudeVersion: string | undefined,
  what: string,
): ReportOutcome => ({
  kind: 'refused',
  message: `${what} (${versionLabel(claudeVersion)})`,
})

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export const parseEvalReport = (text: string): ReportOutcome => {
  const envelope = envelopeSchema.safeParse(parseJson(text))
  if (!envelope.success)
    return refuse(undefined, 'The Eval report could not be read')
  const { schemaVersion, claudeVersion } = envelope.data
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION)
    return refuse(
      claudeVersion,
      `The Eval report has schemaVersion ${String(schemaVersion)}, which this app does not read`,
    )
  const parsed = reportSchema.safeParse(parseJson(text))
  if (!parsed.success)
    return refuse(claudeVersion, 'The Eval report has an unexpected shape')
  const report = parsed.data
  if (report.partial)
    return {
      kind: 'partial',
      reason: report.partialReason ?? null,
      claudeVersion: report.claudeVersion,
    }
  const cases = report.cases.map(({ name, arms }) => ({
    name,
    with: tallyOf(arms.with),
    without: arms.without === undefined ? null : tallyOf(arms.without),
  }))
  const withoutTallies = cases.flatMap(({ without }) =>
    without === null ? [] : [without],
  )
  return {
    kind: 'complete',
    summary: {
      claudeVersion: report.claudeVersion,
      startedAt: report.startedAt,
      costUsd: report.costUsd,
      cases,
      with: sumTallies(cases.map((item) => item.with)),
      without: withoutTallies.length === 0 ? null : sumTallies(withoutTallies),
    },
  }
}
