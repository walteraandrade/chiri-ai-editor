export type RevealPart = {
  readonly text: string
  readonly delayMs: number | null
}

const WORD_STEP_MS = 34
const WORD_BUDGET_MS = 560

export const revealParts = (text: string): readonly RevealPart[] => {
  const words = text.match(/\S+/g) ?? []
  const gaps = text.split(/\S+/)
  const step = Math.min(
    WORD_STEP_MS,
    WORD_BUDGET_MS / Math.max(words.length, 1),
  )
  return gaps.flatMap((gap, index) => {
    const word = words[index]
    return [
      ...(gap === '' ? [] : [{ text: gap, delayMs: null }]),
      ...(word === undefined
        ? []
        : [{ text: word, delayMs: Math.round(index * step) }]),
    ]
  })
}
