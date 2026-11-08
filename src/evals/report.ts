import { z } from 'zod'
import { armTally, type RunRecord, sumTallies, type Tally } from './tally'

export type { RunRecord, Tally }

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
  error: z.string().nullish(),
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
  suite: z
    .object({ plugins: z.array(z.object({ name: z.string() })).default([]) })
    .optional(),
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

type EntryOf = z.infer<typeof entry>
type GraderDefinition = z.infer<typeof graderDefinition>

const matchesSkillName = (pattern: unknown, skillName: string): boolean => {
  if (typeof pattern !== 'string') return true
  try {
    const regex = new RegExp(pattern)
    return [skillName, `${skillName}:${skillName}`].some((name) =>
      regex.test(JSON.stringify({ skill: name })),
    )
  } catch {
    return false
  }
}

const isFiredIndicator =
  (skillName: string | undefined) =>
  ({ type, config }: GraderDefinition): boolean =>
    type === 'tool_used' &&
    config?.tool === 'Skill' &&
    config.max !== 0 &&
    (skillName === undefined || matchesSkillName(config.input_match, skillName))

const endedWithoutGrading = ({ error, graders }: EntryOf): boolean =>
  error != null && graders.length === 0

const recordOf = (
  entries: readonly EntryOf[],
  indicators: ReadonlySet<string> | null,
): readonly RunRecord[] =>
  entries.map((item) => ({
    passed: item.passed,
    errored: endedWithoutGrading(item),
    fired:
      indicators === null || indicators.size === 0
        ? null
        : item.graders.some(
            ({ name, passed }) => passed && indicators.has(name),
          ),
  }))

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
  const skillName = report.suite?.plugins[0]?.name
  const cases = report.cases.map(({ name, arms, graders }) => {
    const indicators = new Set(
      graders.filter(isFiredIndicator(skillName)).map((item) => item.name),
    )
    const withRuns = recordOf(arms.with, indicators)
    const withoutRuns =
      arms.without === undefined ? null : recordOf(arms.without, null)
    return {
      name,
      with: armTally(withRuns),
      without: withoutRuns === null ? null : armTally(withoutRuns),
      runs: { with: withRuns, without: withoutRuns },
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
