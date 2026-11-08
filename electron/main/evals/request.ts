import { z } from 'zod'
import {
  MAX_COST_LIMIT_USD,
  MAX_RUNS,
  MIN_RUNS,
  MODEL_PATTERN,
} from '../../../src/evals/settings'
import type { EvalRunRequest, EvalSkillRequest } from '../../../src/evals/types'
import { pathSchema } from '../files/requests'

const skillRequest = z.strictObject({ skillPath: pathSchema })

const runRequest = z.strictObject({
  skillPath: pathSchema,
  runs: z.number().int().min(MIN_RUNS).max(MAX_RUNS),
  model: z.string().max(100).regex(MODEL_PATTERN),
  maxCostUsd: z.number().positive().max(MAX_COST_LIMIT_USD),
})

export const parseSkillRequest = (input: unknown): EvalSkillRequest | null => {
  const parsed = skillRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}

export const parseRunRequest = (input: unknown): EvalRunRequest | null => {
  const parsed = runRequest.safeParse(input)
  return parsed.success ? parsed.data : null
}
