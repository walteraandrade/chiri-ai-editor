import { z } from 'zod'

export type Tally = {
  readonly passed: number
  readonly total: number
}

export type RunRecord = {
  readonly passed: boolean
  readonly fired: boolean | null
}

export type CaseTally = {
  readonly name: string
  readonly with: Tally
  readonly without: Tally | null
  readonly runs: {
    readonly with: readonly RunRecord[]
    readonly without: readonly RunRecord[] | null
  }
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

const entry = z.object({
  passed: z.boolean(),
  graders: z
    .array(z.object({ name: z.string(), passed: z.boolean() }))
    .default([]),
})

const graderDefinition = z.object({
  name: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).nullish(),
})

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
      graders: z.array(graderDefinition).default([]),
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

type EntryOf = z.infer<typeof entry>

const skillGraderNames = (
  definitions: readonly z.infer<typeof graderDefinition>[],
): ReadonlySet<string> =>
  new Set(
    definitions
      .filter(
        ({ type, config }) => type === 'tool_used' && config?.tool === 'Skill',
      )
      .map(({ name }) => name),
  )

const recordOf = (
  entries: readonly EntryOf[],
  skillGraders: ReadonlySet<string>,
): readonly RunRecord[] =>
  entries.map(({ passed, graders }) => ({
    passed,
    fired:
      skillGraders.size === 0
        ? null
        : graders.some(({ name, passed: ok }) => ok && skillGraders.has(name)),
  }))

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

const costSchema = z.object({ costUsd: z.number() })

export const reportCost = (text: string): number | null => {
  const parsed = costSchema.safeParse(parseJson(text))
  return parsed.success ? parsed.data.costUsd : null
}

export const parseEvalReport = (
  text: string,
  cliVersion?: string,
): ReportOutcome => {
  const envelope = envelopeSchema.safeParse(parseJson(text))
  if (!envelope.success)
    return refuse(cliVersion, 'The Eval report could not be read')
  const schemaVersion = envelope.data.schemaVersion
  const claudeVersion = envelope.data.claudeVersion ?? cliVersion
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
  const cases = report.cases.map(({ name, arms, graders }) => {
    const skill = skillGraderNames(graders)
    return {
      name,
      with: tallyOf(arms.with),
      without: arms.without === undefined ? null : tallyOf(arms.without),
      runs: {
        with: recordOf(arms.with, skill),
        without:
          arms.without === undefined ? null : recordOf(arms.without, skill),
      },
    }
  })
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
