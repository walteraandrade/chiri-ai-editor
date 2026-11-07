const STEP = 10_000
const MIN_LIMIT_USD = 0.0001

const floor4 = (value: number): number => Math.floor(value * STEP) / STEP

export const firstRunLimit = (maxCostUsd: number): number =>
  Math.max(MIN_LIMIT_USD, floor4(maxCostUsd / 2))

export const secondRunLimit = (
  maxCostUsd: number,
  spentUsd: number,
): number | null => {
  const left = floor4(maxCostUsd - spentUsd)
  return left >= MIN_LIMIT_USD ? left : null
}
