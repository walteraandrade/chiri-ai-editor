export type EvalSettings = {
  readonly runs: number
  readonly model: string
  readonly maxCostUsd: number
}

export const MIN_RUNS = 1
export const MAX_RUNS = 5
export const MAX_COST_LIMIT_USD = 5
export const MODEL_PATTERN = /^[A-Za-z][A-Za-z0-9.-]*$/

export const DEFAULT_EVAL_SETTINGS: EvalSettings = {
  runs: 3,
  model: 'haiku',
  maxCostUsd: 1,
}

export const checkEvalSettings = ({
  runs,
  model,
  maxCostUsd,
}: EvalSettings): readonly string[] => [
  ...(Number.isInteger(runs) && runs >= MIN_RUNS && runs <= MAX_RUNS
    ? []
    : [`Runs must be a whole number from ${MIN_RUNS} to ${MAX_RUNS}`]),
  ...(MODEL_PATTERN.test(model)
    ? []
    : ['Model starts with a letter, then letters, digits, "." and "-"']),
  ...(Number.isFinite(maxCostUsd) &&
  maxCostUsd > 0 &&
  maxCostUsd <= MAX_COST_LIMIT_USD
    ? []
    : [`Cost limit must be above 0 and at most US$${MAX_COST_LIMIT_USD}`]),
]
