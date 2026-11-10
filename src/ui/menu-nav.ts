export const nextEnabled = (
  enabled: readonly boolean[],
  from: number,
  step: 1 | -1,
): number => {
  const count = enabled.length
  const start = from < 0 ? (step === 1 ? -1 : count) : from
  const candidates = Array.from(
    { length: count },
    (_, offset) => (((start + step * (offset + 1)) % count) + count) % count,
  )
  return candidates.find((index) => enabled[index]) ?? -1
}
