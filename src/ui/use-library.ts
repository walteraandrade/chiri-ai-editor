import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryKit } from '../platform/kit'
import type {
  CreateSkillRequest,
  CreateSkillResult,
  LibraryListing,
} from '../skills/library'
import { sameLibrary } from '../skills/library-view'

export type LibraryState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly roots: LibraryListing
      readonly problem: string | null
    }
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
    setState((previous) =>
      result.kind !== 'listed'
        ? { status: 'failed' }
        : previous.status === 'ready' && sameLibrary(previous, result)
          ? previous
          : { status: 'ready', roots: result.roots, problem: result.problem },
    )
  }, [library])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => library?.subscribe(() => void refresh()), [library, refresh])

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

  const createSkill = useCallback(
    async (request: CreateSkillRequest): Promise<CreateSkillResult> => {
      if (library === undefined)
        return { kind: 'failed', reason: 'No Library here' }
      const result = await library.createSkill(request)
      if (result.kind === 'created') await refresh()
      return result
    },
    [library, refresh],
  )

  return { state, refresh, addRoot, removeRoot, createSkill }
}

export type LibraryControls = ReturnType<typeof useLibrary>
