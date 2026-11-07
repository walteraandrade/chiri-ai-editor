export type EvalCommandInput = {
  readonly runs: number
  readonly model: string
  readonly maxCostUsd: number
  readonly jsonFile: string
  readonly outputDir: string
}

export const buildEvalArgs = ({
  runs,
  model,
  maxCostUsd,
  jsonFile,
  outputDir,
}: EvalCommandInput): readonly string[] => [
  'plugin',
  'eval',
  '.',
  '--trust-plugin',
  '--no-publish',
  '--threshold',
  '0',
  '--max-cost-usd',
  String(maxCostUsd),
  '--runs',
  String(runs),
  `--model=${model}`,
  '--json',
  jsonFile,
  '--output-dir',
  outputDir,
]
