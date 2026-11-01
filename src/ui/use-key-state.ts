import { useCallback, useState } from 'react'
import type { KeyState } from '../../electron/api'
import type { KeySettings, PlatformKit } from '../platform/kit'

export type KeyView = {
  readonly present: boolean
  readonly settings: KeySettings | undefined
  readonly state: KeyState | undefined
  readonly dialogOpen: boolean
  readonly openDialog: () => void
  readonly closeDialog: () => void
  readonly setState: (state: KeyState) => void
}

export const useKeyState = ({
  keyStatus,
  keySettings,
}: Pick<PlatformKit, 'keyStatus' | 'keySettings'>): KeyView => {
  const [state, setState] = useState(keySettings?.state)
  const [dialogOpen, setDialogOpen] = useState(false)
  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])
  return {
    present: state?.present ?? keyStatus.present,
    settings: keySettings,
    state,
    dialogOpen,
    openDialog,
    closeDialog,
    setState,
  }
}
