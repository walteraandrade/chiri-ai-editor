import type {
  AddRootResult,
  CreateSkillRequest,
  CreateSkillResult,
  LibrarySnapshot,
  RemoveRootResult,
} from '../src/skills/library'
import type { HistoryApi } from './history-api'

export const SHELL_INFO_CHANNEL = 'shell:info'
export const FILE_OPEN_CHANNEL = 'file:open'
export const FILE_READ_CHANNEL = 'file:read'
export const FILE_SAVE_CHANNEL = 'file:save'
export const FILE_SAVE_AS_CHANNEL = 'file:save-as'
export const LIBRARY_LIST_CHANNEL = 'library:list'
export const LIBRARY_ADD_ROOT_CHANNEL = 'library:add-root'
export const LIBRARY_REMOVE_ROOT_CHANNEL = 'library:remove-root'
export const WATCH_FILE_CHANNEL = 'external:watch-file'
export const EXTERNAL_CHANGES_CHANNEL = 'external:changes'
export const LIBRARY_CREATE_SKILL_CHANNEL = 'library:create-skill'

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

export type ExternalChanges = {
  readonly paths: readonly string[]
  readonly library: boolean
}

export type ChiriApi = {
  readonly shellInfo: () => Promise<ShellInfo>
  readonly openFile: () => Promise<FileReadResult>
  readonly readFile: (path: string) => Promise<FileReadResult>
  readonly saveFile: (request: SaveFileRequest) => Promise<FileSaveResult>
  readonly saveFileAs: (request: SaveFileAsRequest) => Promise<FileSaveResult>
  readonly listLibrary: () => Promise<LibrarySnapshot>
  readonly addLibraryRoot: () => Promise<AddRootResult>
  readonly removeLibraryRoot: (path: string) => Promise<RemoveRootResult>
  readonly watchFile: (path: string | null) => Promise<void>
  readonly onExternalChanges: (
    listener: (changes: ExternalChanges) => void,
  ) => () => void
  readonly createSkill: (
    request: CreateSkillRequest,
  ) => Promise<CreateSkillResult>
} & HistoryApi
