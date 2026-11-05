import type { KeyState } from '../../electron/api'
import type { FileSession } from '../document/file-session'
import type { Unsaved } from '../document/unsaved'
import type { SwitchableHistory } from '../history/hub'
import type {
  AddRootResult,
  CreateSkillRequest,
  CreateSkillResult,
  LibraryListing,
  RemoveRootResult,
} from '../skills/library'
import type { Problems } from './problems'

export type FileContents<Ref> = {
  readonly name: string
  readonly text: string
  readonly ref: Ref | null
}

export type OpenResult<Ref> =
  | { readonly kind: 'opened'; readonly file: FileContents<Ref> }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason?: string }

export type SaveRequest<Ref> = {
  readonly text: string
  readonly ref: Ref | null
  readonly name: string
  readonly expected: string | null
  readonly saveAs: boolean
}

export type SaveResult<Ref> =
  | {
      readonly kind: 'saved'
      readonly name: string
      readonly ref: Ref | null
      readonly method: 'write' | 'download'
    }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason?: string }

export type DocumentFiles<Ref> = {
  readonly open: () => Promise<OpenResult<Ref>>
  readonly read: (ref: Ref) => Promise<OpenResult<Ref>>
  readonly save: (request: SaveRequest<Ref>) => Promise<SaveResult<Ref>>
}

export type UnsavedStore<Ref> = {
  readonly load: (ref: Ref) => Promise<Unsaved | null>
  readonly keep: (ref: Ref, unsaved: Unsaved) => void
  readonly drop: (ref: Ref) => void
}

export type UnsavedText<Ref> = {
  readonly initial: string
  readonly untitledBaseline: string
  readonly changed: (text: string, file: FileSession<Ref> | null) => void
  readonly offered: (ref: Ref) => Promise<Unsaved | null>
  readonly discard?: (ref: Ref) => void
}

export type StartFile<Ref> = {
  readonly name: string
  readonly ref: Ref | null
  readonly savedText: string
  readonly diskChanged: boolean
}

export type KeyStatus = {
  readonly present: boolean
}

export type LibraryList =
  | {
      readonly kind: 'listed'
      readonly roots: LibraryListing
      readonly problem: string | null
    }
  | { readonly kind: 'failed' }

export type LibraryKit<Ref> = {
  readonly list: () => Promise<LibraryList>
  readonly addRoot: () => Promise<AddRootResult>
  readonly removeRoot: (path: string) => Promise<RemoveRootResult>
  readonly createSkill: (
    request: CreateSkillRequest,
  ) => Promise<CreateSkillResult>
  readonly toRef: (path: string) => Ref
  readonly folderNameOf: (ref: Ref) => string | undefined
  readonly subscribe: (listener: () => void) => () => void
}

export type KeySettings = {
  readonly state: KeyState
  readonly save: (key: string) => Promise<KeyState>
  readonly keepAsPlainText: () => Promise<KeyState>
  readonly clear: () => Promise<KeyState>
}

export type DiskRead =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly text: string
    }
  | { readonly kind: 'gone' }
  | { readonly kind: 'unreadable' }

export type ExternalChange<Ref> = {
  readonly touches: (ref: Ref) => boolean
}

export type ExternalKit<Ref> = {
  readonly watch: (ref: Ref | null) => void
  readonly subscribe: (
    listener: (change: ExternalChange<Ref>) => void,
  ) => () => void
  readonly readDisk: (ref: Ref) => Promise<DiskRead>
}

export type LaunchKit<Ref> = {
  readonly take: () => Promise<Ref | null>
  readonly subscribe: (listener: (ref: Ref) => void) => () => void
}

export type PlatformKit<Ref = unknown> = {
  readonly files: DocumentFiles<Ref>
  readonly unsavedText: UnsavedText<Ref>
  readonly start: StartFile<Ref> | null
  readonly notice: string | null
  readonly history: SwitchableHistory<Ref>
  readonly keyStatus: KeyStatus
  readonly keySettings?: KeySettings
  readonly problems: Problems
  readonly library?: LibraryKit<Ref>
  readonly external?: ExternalKit<Ref>
  readonly launches?: LaunchKit<Ref>
  readonly preferencesRequests?: (listener: () => void) => () => void
}

export type PlatformKitFactory<Ref = unknown> = () => Promise<PlatformKit<Ref>>
