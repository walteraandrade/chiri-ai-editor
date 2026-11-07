import { useCallback, useRef, useState } from 'react'
import { appClient } from '../ai/app-client'
import type { DescriptionPromptInput } from '../ai/prompts'
import { descriptionOutcome, descriptionSource } from '../skills/description-ai'
import { describeError } from '../suggestions/error-message'

export type DescriptionAiState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working'; readonly source: string }
  | {
      readonly kind: 'ready'
      readonly source: string
      readonly description: string
      readonly rationale: string
    }
  | {
      readonly kind: 'failed'
      readonly source: string
      readonly message: string
    }

export type DescriptionAi = {
  readonly state: DescriptionAiState
  readonly ask: (input: DescriptionPromptInput) => void
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

  const ask = useCallback(
    ({ name, description, body }: DescriptionPromptInput) => {
      controller.current?.abort()
      const own = new AbortController()
      controller.current = own
      const source = descriptionSource(name, description)
      setState({ kind: 'working', source })
      void appClient
        .requestDescription({ name, description, body, signal: own.signal })
        .then((result) => {
          if (own.signal.aborted) return
          if (!result.ok) {
            setState({
              kind: 'failed',
              source,
              message: describeError(result.error),
            })
            return
          }
          const outcome = descriptionOutcome(
            result.value.replacement,
            description,
          )
          setState(
            outcome.kind === 'failed'
              ? { kind: 'failed', source, message: outcome.message }
              : {
                  kind: 'ready',
                  source,
                  description: outcome.description,
                  rationale: result.value.rationale,
                },
          )
        })
    },
    [],
  )

  return { state, ask, dismiss }
}
