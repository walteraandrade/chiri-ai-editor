export type DiskText = string | null

export type ExternalChangeFacts = {
  readonly disk: DiskText
  readonly savedText: string
  readonly document: string
  readonly writing: string | null
  readonly noticed: { readonly disk: DiskText } | null
}

export type ExternalVerdict = 'nothing' | 'settled' | 'reload' | 'notice'

export const decideExternalChange = ({
  disk,
  savedText,
  document,
  writing,
  noticed,
}: ExternalChangeFacts): ExternalVerdict => {
  if (disk !== null && disk === writing) return 'nothing'
  if (disk !== null && disk === savedText) return 'settled'
  if (noticed !== null && noticed.disk === disk) return 'nothing'
  if (disk === null) return 'notice'
  return document === savedText || document === disk ? 'reload' : 'notice'
}
