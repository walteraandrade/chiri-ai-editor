import { decodeMarkdown } from './markdown-file'

type WritableText = {
  readonly write: (data: string) => Promise<void>
  readonly close: () => Promise<void>
}

export type MarkdownFileHandle = {
  readonly name: string
  readonly getFile: () => Promise<File>
  readonly createWritable: () => Promise<WritableText>
}

type PickerType = {
  readonly description: string
  readonly accept: Readonly<Record<string, readonly string[]>>
}

type OpenPickerOptions = {
  readonly id: string
  readonly types: readonly PickerType[]
  readonly multiple: false
}

type SavePickerOptions = {
  readonly id: string
  readonly types: readonly PickerType[]
  readonly suggestedName: string
}

export type FileHost = {
  readonly showOpenFilePicker?: (
    options: OpenPickerOptions,
  ) => Promise<readonly MarkdownFileHandle[]>
  readonly showSaveFilePicker?: (
    options: SavePickerOptions,
  ) => Promise<MarkdownFileHandle>
}

export type FileFallback = {
  readonly pickFile: () => Promise<File | null>
  readonly download: (name: string, text: string) => void
}

export type OpenedFile = {
  readonly name: string
  readonly text: string
  readonly handle: MarkdownFileHandle | null
}

export type SavedFile = {
  readonly name: string
  readonly handle: MarkdownFileHandle | null
  readonly method: 'write' | 'download'
}

export type SaveRequest = {
  readonly text: string
  readonly handle: MarkdownFileHandle | null
  readonly name: string
  readonly saveAs: boolean
}

const PICKER_ID = 'markdown'
const PICKER_TYPES: readonly PickerType[] = [
  {
    description: 'Markdown',
    accept: { 'text/markdown': ['.md', '.markdown'] },
  },
]

type Pickers = Required<FileHost>

export const supportsFileHandles = (host: FileHost): host is Pickers =>
  typeof host.showOpenFilePicker === 'function' &&
  typeof host.showSaveFilePicker === 'function'

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'

const unlessCancelled = async <T>(
  pick: () => Promise<T>,
): Promise<T | null> => {
  try {
    return await pick()
  } catch (error) {
    if (isAbort(error)) return null
    throw error
  }
}

const readFile = async (
  file: File,
  handle: MarkdownFileHandle | null,
): Promise<OpenedFile> => ({
  name: file.name,
  text: decodeMarkdown(await file.text()),
  handle,
})

export const openMarkdownFile = async (
  host: FileHost,
  fallback: FileFallback,
): Promise<OpenedFile | null> => {
  if (!supportsFileHandles(host)) {
    const file = await fallback.pickFile()
    return file === null ? null : readFile(file, null)
  }
  const handles = await unlessCancelled(() =>
    host.showOpenFilePicker({
      id: PICKER_ID,
      types: PICKER_TYPES,
      multiple: false,
    }),
  )
  const handle = handles?.[0]
  return handle === undefined ? null : readFile(await handle.getFile(), handle)
}

const writeText = async (
  handle: MarkdownFileHandle,
  text: string,
): Promise<void> => {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

export const saveMarkdownFile = async (
  host: FileHost,
  fallback: FileFallback,
  { text, handle, name, saveAs }: SaveRequest,
): Promise<SavedFile | null> => {
  if (!supportsFileHandles(host)) {
    fallback.download(name, text)
    return { name, handle: null, method: 'download' }
  }
  const target =
    !saveAs && handle !== null
      ? handle
      : await unlessCancelled(() =>
          host.showSaveFilePicker({
            id: PICKER_ID,
            types: PICKER_TYPES,
            suggestedName: name,
          }),
        )
  if (target === null) return null
  await writeText(target, text)
  return { name: target.name, handle: target, method: 'write' }
}
