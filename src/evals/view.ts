import type { Tally } from './report'

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
