import { extname } from 'node:path'

export const MASK = 'sk-or-***MASKED***'

const MIN_SECRET_LENGTH = 8

const KEY_PATTERN = /sk-or-[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?/g
const RESIDUAL_PATTERN = /sk-or-[A-Za-z0-9]/g

const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
])

export type MaskResult = {
  readonly text: string
  readonly spans: number
}

export type ByteMaskResult = {
  readonly bytes: Buffer
  readonly spans: number
}

const usableSecrets = (secrets: readonly string[]): readonly string[] =>
  [
    ...new Set(secrets.filter((secret) => secret.length >= MIN_SECRET_LENGTH)),
  ].sort((a, b) => b.length - a.length)

const maskExact = (acc: MaskResult, secret: string): MaskResult => {
  const parts = acc.text.split(secret)
  return { text: parts.join(MASK), spans: acc.spans + parts.length - 1 }
}

export const maskSecrets = (
  text: string,
  exactSecrets: readonly string[] = [],
): MaskResult => {
  const afterExact = usableSecrets(exactSecrets).reduce(maskExact, {
    text,
    spans: 0,
  })
  const patternSpans = [...afterExact.text.matchAll(KEY_PATTERN)].length
  return {
    text: afterExact.text.replace(KEY_PATTERN, MASK),
    spans: afterExact.spans + patternSpans,
  }
}

export const residualKeyCount = (text: string): number =>
  [...text.matchAll(RESIDUAL_PATTERN)].length

const toLatin1View = (value: string): string =>
  Buffer.from(value, 'utf8').toString('latin1')

export const maskBytes = (
  bytes: Buffer,
  exactSecrets: readonly string[] = [],
): ByteMaskResult => {
  const { text, spans } = maskSecrets(
    bytes.toString('latin1'),
    exactSecrets.map(toLatin1View),
  )
  return { bytes: Buffer.from(text, 'latin1'), spans }
}

export const countSecretOccurrences = (
  bytes: Buffer,
  exactSecrets: readonly string[],
): number => {
  const view = bytes.toString('latin1')
  return usableSecrets(exactSecrets.map(toLatin1View)).reduce(
    (sum, secret) => sum + view.split(secret).length - 1,
    0,
  )
}

export const isTextFile = (path: string, bytes: Buffer): boolean =>
  !BINARY_EXTENSIONS.has(extname(path).toLowerCase()) && !bytes.includes(0)
