import type { RootScan } from './scan-skills'

export type LibraryRoot = RootScan & {
  readonly label: string
  readonly removable: boolean
}

export type LibraryListing = readonly LibraryRoot[]

export type AddRootResult =
  | { readonly kind: 'added'; readonly label: string }
  | { readonly kind: 'duplicate'; readonly label: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly reason: string }

export type RemoveRootResult =
  | { readonly kind: 'removed' }
  | { readonly kind: 'failed'; readonly reason: string }
