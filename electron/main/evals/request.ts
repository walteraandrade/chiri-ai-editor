import { z } from 'zod'
import {
  MAX_COST_LIMIT_USD,
  MAX_RUNS,
  MIN_RUNS,
  MODEL_PATTERN,
} from '../../../src/evals/settings'
import type {
  EvalOpenReportRequest,
  EvalPrepareRequest,
  EvalRunRequest,
  EvalSkillRequest,
} from '../../../src/evals/types'
import { pathSchema } from '../files/requests'

const skillRequest = z.strictObject({ skillPath: pathSchema })

const cancelRequest = z.union([z.undefined(), z.strictObject({})])

const baselineSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('version'),
    versionId: z.number().int().min(1),
  }),
])

const prepareRequest = z.strictObject({
  skillPath: pathSchema,
  baseline: baselineSchema,
})

const runRequest = z.strictObject({
  skillPath: pathSchema,
  baseline: baselineSchema,
  runs: z.number().int().min(MIN_RUNS).max(MAX_RUNS),
  model: z.string().max(100).regex(MODEL_PATTERN),
  maxCostUsd: z.number().positive().max(MAX_COST_LIMIT_USD),
})

export const parseSkillRequest = (input: unknown): EvalSkillRequest | null => {
  const parsed = skillRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}

const openReportRequest = z.strictObject({
  skillPath: pathSchema,
  part: z.enum(['today', 'version']).optional(),
})

export const parseOpenReportRequest = (
  input: unknown,
): EvalOpenReportRequest | null => {
  const parsed = openReportRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}

export const parsePrepareRequest = (
  input: unknown,
): EvalPrepareRequest | null => {
  const parsed = prepareRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}

export const parseRunRequest = (input: unknown): EvalRunRequest | null => {
  const parsed = runRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}

export const parseCancelRequest = (input: unknown): true | null =>
  cancelRequest.safeParse(input).success ? true : null
