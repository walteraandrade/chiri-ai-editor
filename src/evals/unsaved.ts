type UnsavedInput = {
  readonly files: readonly string[]
  readonly isOpen: (file: string) => boolean
  readonly openDirty: boolean
  readonly stored: ReadonlySet<string>
}

const SHOWN_FILES = 2

export const filesWithUnsavedText = ({
  files,
  isOpen,
  openDirty,
  stored,
}: UnsavedInput): readonly string[] =>
  files.filter((file) => (isOpen(file) ? openDirty : stored.has(file)))

const listOf = (names: readonly string[]): string =>
  names.length <= SHOWN_FILES + 1
    ? names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
      : (names[0] ?? '')
    : `${names.slice(0, SHOWN_FILES).join(', ')} and ${names.length - SHOWN_FILES} more`

export const unsavedNotice = (names: readonly string[]): string | null =>
  names.length === 0
    ? null
    : `Unsaved text in ${listOf(names)}. A run reads what is saved on disk.`
