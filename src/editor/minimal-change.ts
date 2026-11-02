export type TextChange = {
  readonly from: number
  readonly to: number
  readonly insert: string
}

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff

const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code <= 0xdfff

const countWhile = (
  limit: number,
  same: (index: number) => boolean,
): number => {
  let count = 0
  while (count < limit && same(count)) count += 1
  return count
}

const sharedPrefix = (before: string, after: string): number =>
  countWhile(
    Math.min(before.length, after.length),
    (index) => before.charCodeAt(index) === after.charCodeAt(index),
  )

const sharedSuffix = (before: string, after: string, prefix: number): number =>
  countWhile(
    Math.min(before.length, after.length) - prefix,
    (index) =>
      before.charCodeAt(before.length - 1 - index) ===
      after.charCodeAt(after.length - 1 - index),
  )

export const minimalChange = (before: string, after: string): TextChange => {
  const rawPrefix = sharedPrefix(before, after)
  const prefix =
    rawPrefix > 0 && isHighSurrogate(before.charCodeAt(rawPrefix - 1))
      ? rawPrefix - 1
      : rawPrefix
  const rawSuffix = sharedSuffix(before, after, prefix)
  const suffix =
    rawSuffix > 0 &&
    isLowSurrogate(before.charCodeAt(before.length - rawSuffix))
      ? rawSuffix - 1
      : rawSuffix
  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  }
}
