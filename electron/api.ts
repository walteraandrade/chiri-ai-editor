import type { HistoryApi } from './history-api'

export const SHELL_INFO_CHANNEL = 'shell:info'
export const FILE_OPEN_CHANNEL = 'file:open'
export const FILE_READ_CHANNEL = 'file:read'
export const FILE_SAVE_CHANNEL = 'file:save'
export const FILE_SAVE_AS_CHANNEL = 'file:save-as'

export const FILE_NOT_FOUND_REASON = 'File not found'

export type ShellInfo = {
  readonly electron: string
  readonly chrome: string
  readonly platform: string
}

export type FileReadResult =
  | {
      readonly kind: 'opened'
      readonly path: string
      readonly name: string
      readonly text: string
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason: string }

export type FileSaveResult =
  | {
      readonly kind: 'saved'
      readonly path: string
      readonly name: string
    }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason: string }

export type SaveFileRequest = {
  readonly path: string
  readonly text: string
  readonly expected: string
}

export type SaveFileAsRequest = {
  readonly text: string
  readonly suggestedName: string
}

export type ChiriApi = {
  readonly shellInfo: () => Promise<ShellInfo>
  readonly openFile: () => Promise<FileReadResult>
  readonly readFile: (path: string) => Promise<FileReadResult>
  readonly saveFile: (request: SaveFileRequest) => Promise<FileSaveResult>
  readonly saveFileAs: (request: SaveFileAsRequest) => Promise<FileSaveResult>
} & HistoryApi
