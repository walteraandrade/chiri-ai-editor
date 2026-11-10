type Rgb = readonly [number, number, number]

export const rgbOf = (hex: string): Rgb => {
  const digits = hex.slice(1)
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join('')
      : digits.slice(0, 6)
  const channel = (start: number): number =>
    Number.parseInt(full.slice(start, start + 2), 16)
  return [channel(0), channel(2), channel(4)]
}

const linear = (channel: number): number => {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string): number => {
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

const toHex = (channel: number): string =>
  Math.round(channel).toString(16).padStart(2, '0')

export const mixHex = (from: string, to: string, share: number): string => {
  const [r1, g1, b1] = rgbOf(from)
  const [r2, g2, b2] = rgbOf(to)
  const mix = (a: number, b: number): string => toHex(a + (b - a) * share)
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`
}

export const sixDigitHex = (hex: string): string =>
  `#${rgbOf(hex).map(toHex).join('')}`
