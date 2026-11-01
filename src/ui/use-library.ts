import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryKit } from '../platform/kit'
import type { LibraryListing } from '../skills/library'

export type LibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly roots: LibraryListing }
  | { readonly status: 'failed' }

export const useLibrary = <Ref>(
  library: LibraryKit<Ref> | undefined,
  notify: (text: string) => void,
) => {
  const [state, setState] = useState<LibraryState>({ status: 'loading' })
  const latestLoad = useRef(0)

  const refresh = useCallback(async () => {
    if (library === undefined) return
    const load = ++latestLoad.current
    const result = await library.list()
    if (load !== latestLoad.current) return
    setState(
      result.kind === 'listed'
        ? { status: 'ready', roots: result.roots }
        : { status: 'failed' },
    )
  }, [library])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addRoot = useCallback(async () => {
    if (library === undefined) return
    const result = await library.addRoot()
    if (result.kind === 'cancelled') return
    if (result.kind === 'failed') {
      notify(`Could not add the folder: ${result.reason}`)
      return
    }
    notify(
      result.kind === 'added'
        ? `Added ${result.label}`
        : `${result.label} is already in the Library`,
    )
    await refresh()
  }, [library, notify, refresh])

  const removeRoot = useCallback(
    async (path: string, label: string) => {
      if (library === undefined) return
      const result = await library.removeRoot(path)
      notify(
        result.kind === 'removed'
          ? `Removed ${label}`
          : `Could not remove ${label}: ${result.reason}`,
      )
      await refresh()
    },
    [library, notify, refresh],
  )

  return { state, refresh, addRoot, removeRoot }
}

export type LibraryControls = ReturnType<typeof useLibrary>
