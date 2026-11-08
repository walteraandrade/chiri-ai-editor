const STEP = 10_000
const MIN_LIMIT_USD = 0.0001

const floor4 = (value: number): number => Math.floor(value * STEP) / STEP

export const FIRST_SIDE_NOTE = 'half for each side'
export const SECOND_SIDE_NOTE = 'what the first side left'
export const NOTHING_LEFT_NOTE = 'nothing left for the second side'
export const LIMIT_TOO_SMALL =
  'The cost limit is too small to share between two runs'

export const firstRunLimit = (maxCostUsd: number): number | null => {
  const half = floor4(maxCostUsd / 2)
  return half >= MIN_LIMIT_USD ? half : null
}

export const secondRunLimit = (
  maxCostUsd: number,
  spentUsd: number,
): number | null => {
  const left = floor4(maxCostUsd - spentUsd)
  return left >= MIN_LIMIT_USD ? left : null
}
