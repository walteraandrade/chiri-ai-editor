import type { EvalRunResult } from './types'
import { stoppedText } from './view'

type Failure = Exclude<
  EvalRunResult,
  { readonly kind: 'completed' } | { readonly kind: 'not-complete' }
>

const REASONS = {
  'no-cli': 'The Claude CLI was not found',
  'risks-changed': 'The Skill changed while you were confirming. Run again.',
  busy: 'Another Eval run is in progress',
} as const

export const failureReason = (result: Failure): string =>
  result.kind === 'failed' ? result.reason : REASONS[result.kind]

export const endedText = (name: string, result: EvalRunResult): string =>
  result.kind === 'completed'
    ? `Evals for ${name} finished`
    : result.kind === 'not-complete'
      ? `${name}: ${stoppedText(result)}`
      : `${name}: ${failureReason(result)}`
