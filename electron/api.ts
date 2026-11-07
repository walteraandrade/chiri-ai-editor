import type {
  EvalCancelResult,
  EvalOpenReportResult,
  EvalPrepareResult,
  EvalRunRequest,
  EvalRunResult,
  EvalSkillRequest,
  EvalStatus,
} from '../src/evals/types'
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
export const LAUNCH_TAKE_CHANNEL = 'launch:take'
export const LAUNCH_FILE_CHANNEL = 'launch:file'
export const PREFERENCES_REQUEST_CHANNEL = 'menu:preferences'
export const QUICK_ACTIONS_LOAD_CHANNEL = 'quick-actions:load'
export const QUICK_ACTIONS_SAVE_CHANNEL = 'quick-actions:save'

export const EVALS_STATUS_CHANNEL = 'evals:status'
export const EVALS_PREPARE_CHANNEL = 'evals:prepare'
export const EVALS_RUN_CHANNEL = 'evals:run'
export const EVALS_OPEN_REPORT_CHANNEL = 'evals:open-report'
export const EVALS_CANCEL_CHANNEL = 'evals:cancel'

export const KEY_STATE_CHANNEL = 'key:state'
export const KEY_SAVE_CHANNEL = 'key:save'
export const KEY_KEEP_AS_PLAIN_TEXT_CHANNEL = 'key:keep-as-plain-text'
export const KEY_CLEAR_CHANNEL = 'key:clear'

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

export type KeyStorage = 'keyring' | 'plain-text' | 'session' | 'none'

export type KeyDetails = {
  readonly present: boolean
  readonly storage: KeyStorage
  readonly keyringAvailable: boolean
  readonly keyringStored: boolean
  readonly backend: string
  readonly unreadable: boolean
}

export type KeyState = KeyDetails & { readonly managed: boolean }

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
  readonly takeLaunchFile: () => Promise<string | null>
  readonly onLaunchFile: (listener: () => void) => () => void
  readonly onPreferencesRequest: (listener: () => void) => () => void
  readonly loadQuickActions: () => Promise<string | null>
  readonly saveQuickActions: (text: string) => Promise<void>
  readonly evalStatus: (request: EvalSkillRequest) => Promise<EvalStatus>
  readonly evalPrepare: (
    request: EvalSkillRequest,
  ) => Promise<EvalPrepareResult>
  readonly evalRun: (request: EvalRunRequest) => Promise<EvalRunResult>
  readonly evalOpenReport: (
    request: EvalSkillRequest,
  ) => Promise<EvalOpenReportResult>
  readonly evalCancel: () => Promise<EvalCancelResult>
  readonly keyState: () => Promise<KeyState>
  readonly saveKey: (key: string) => Promise<KeyState>
  readonly keepKeyAsPlainText: () => Promise<KeyState>
  readonly clearKey: () => Promise<KeyState>
} & HistoryApi
