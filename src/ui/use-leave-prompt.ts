import { useCallback, useRef, useState } from 'react'
import type { LeaveChoice } from '../document/leave-guard'

export type LeavePrompt = {
  readonly name: string
  readonly resolve: (choice: LeaveChoice) => void
}

export const useLeavePrompt = () => {
  const [prompt, setPrompt] = useState<LeavePrompt | null>(null)
  const pending = useRef<LeavePrompt | null>(null)

  const ask = useCallback(
    (name: string) =>
      new Promise<LeaveChoice>((resolve) => {
        pending.current?.resolve('cancel')
        pending.current = { name, resolve }
        setPrompt(pending.current)
      }),
    [],
  )

  const answer = useCallback((choice: LeaveChoice) => {
    pending.current?.resolve(choice)
    pending.current = null
    setPrompt(null)
  }, [])

  return { prompt, ask, answer }
}
