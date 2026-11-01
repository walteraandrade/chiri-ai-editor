import type { FileSession } from '../document/file-session'
import type { Unsaved } from '../document/unsaved'
import type { SwitchableHistory } from '../history/hub'
import type {
  AddRootResult,
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
  | { readonly kind: 'listed'; readonly roots: LibraryListing }
  | { readonly kind: 'failed' }

export type LibraryKit<Ref> = {
  readonly list: () => Promise<LibraryList>
  readonly addRoot: () => Promise<AddRootResult>
  readonly removeRoot: (path: string) => Promise<RemoveRootResult>
  readonly toRef: (path: string) => Ref
}

export type PlatformKit<Ref = unknown> = {
  readonly files: DocumentFiles<Ref>
  readonly unsavedText: UnsavedText<Ref>
  readonly start: StartFile<Ref> | null
  readonly notice: string | null
  readonly history: SwitchableHistory<Ref>
  readonly keyStatus: KeyStatus
  readonly problems: Problems
  readonly library?: LibraryKit<Ref>
}

export type PlatformKitFactory<Ref = unknown> = () => Promise<PlatformKit<Ref>>
