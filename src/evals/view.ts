import { type SummaryBaseline, TODAY_LABEL, versionLabel } from './baseline'
import type { Tally } from './report'
import type { SuspiciousKind } from './signals'

export const countLabel = ({ passed, total }: Tally): string =>
  `${passed}/${total}`

const SMALL_COST_USD = 0.1

const amount = (costUsd: number): string =>
  costUsd === 0
    ? '0'
    : costUsd < SMALL_COST_USD
      ? costUsd.toFixed(4)
      : costUsd.toFixed(2)

export const costEstimate = (costUsd: number): string =>
  `about US$${amount(costUsd)}`

export const stoppedText = ({
  message,
  costUsd,
}: {
  readonly message: string
  readonly costUsd: number | null
}): string =>
  costUsd === null
    ? message
    : `${message}. Cost ${costEstimate(costUsd)}, the CLI's figure.`

export type ArmLabels = {
  readonly first: string
  readonly second: string
}

export const SKILL_ARMS: ArmLabels = {
  first: 'with the Skill',
  second: 'without the Skill',
}

export const armLabelsOf = (
  baseline: SummaryBaseline,
  formatTime: (at: number) => string,
): ArmLabels =>
  baseline.kind === 'none'
    ? SKILL_ARMS
    : { first: TODAY_LABEL, second: versionLabel(baseline.at, formatTime) }

export const suspiciousText = (
  kind: SuspiciousKind,
  { first, second }: ArmLabels = SKILL_ARMS,
): string =>
  kind === 'passes-in-both'
    ? `passes ${first} and ${second}, so it does not tell them apart`
    : kind === 'fails-in-both'
      ? `fails ${first} and ${second}, so it is likely broken`
      : 'its runs disagree, so it is noisy'

export const erroredText = (count: number): string =>
  `${count} ${count === 1 ? 'run' : 'runs'} ended on an error and ${count === 1 ? 'is' : 'are'} not counted`

export const leftOutText = (count: number): string =>
  `${count} ${count === 1 ? 'Eval has' : 'Evals have'} no run without the Skill and ${count === 1 ? 'is' : 'are'} left out of the comparison`

export const unpairedText = (count: number): string =>
  `${count} ${count === 1 ? 'Eval has' : 'Evals have'} a run in only one Stage and ${count === 1 ? 'is' : 'are'} left out of the comparison`
