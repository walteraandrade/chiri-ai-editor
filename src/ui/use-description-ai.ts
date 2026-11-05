import { useCallback, useRef, useState } from 'react'
import { appClient } from '../ai/app-client'
import {
  descriptionRequest,
  normalizeDescription,
} from '../skills/description-ai'
import { describeError } from '../suggestions/error-message'

export type DescriptionAiState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | {
      readonly kind: 'ready'
      readonly description: string
      readonly rationale: string
    }
  | { readonly kind: 'failed'; readonly message: string }

export type DescriptionAi = {
  readonly state: DescriptionAiState
  readonly ask: (name: string, description: string) => void
  readonly dismiss: () => void
}

const idle: DescriptionAiState = { kind: 'idle' }

export const useDescriptionAi = (): DescriptionAi => {
  const [state, setState] = useState<DescriptionAiState>(idle)
  const controller = useRef<AbortController | null>(null)

  const dismiss = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState(idle)
  }, [])

  const ask = useCallback((name: string, description: string) => {
    controller.current?.abort()
    const own = new AbortController()
    controller.current = own
    setState({ kind: 'working' })
    void appClient
      .requestSuggestion({
        ...descriptionRequest(name, description),
        task: 'improve skill description',
        signal: own.signal,
      })
      .then((result) => {
        if (own.signal.aborted) return
        const next = result.ok
          ? normalizeDescription(result.value.replacement)
          : ''
        setState(
          !result.ok
            ? { kind: 'failed', message: describeError(result.error) }
            : next === '' || next === description.trim()
              ? { kind: 'failed', message: 'No better description came back.' }
              : {
                  kind: 'ready',
                  description: next,
                  rationale: result.value.rationale,
                },
        )
      })
  }, [])

  return { state, ask, dismiss }
}
