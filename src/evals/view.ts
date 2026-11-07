import type { Tally } from './report'
import type { SuspiciousKind, Verdict } from './signals'

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

export const suspiciousText = (kind: SuspiciousKind): string =>
  kind === 'passes-in-both'
    ? 'passes with and without the Skill, so it does not tell them apart'
    : kind === 'fails-in-both'
      ? 'fails with and without the Skill, so it is likely broken'
      : 'its runs disagree, so it is noisy'

export const verdictText = (verdict: Verdict | null): string =>
  verdict === 'more'
    ? 'More passes with the Skill'
    : verdict === 'fewer'
      ? 'Fewer passes with the Skill'
      : verdict === 'same'
        ? 'Same passes with and without'
        : 'No run without the Skill to compare'
