import type { EvalSummary } from './report'
import type { Risk } from './risks'
import type { EvalSettings } from './settings'

export type EvalSkillRequest = {
  readonly skillPath: string
}

export type EvalRunRequest = EvalSkillRequest & EvalSettings

export type StoppedRun = {
  readonly message: string
  readonly costUsd: number | null
}

export type EvalStatus =
  | {
      readonly kind: 'ready'
      readonly claudeVersion: string
      readonly last: EvalSummary | null
      readonly running: boolean
      readonly cancelling: boolean
      readonly stopped: StoppedRun | null
    }
  | { readonly kind: 'no-cli' }
  | { readonly kind: 'failed'; readonly reason: string }

export type EvalPrepareResult =
  | {
      readonly kind: 'ready'
      readonly claudeVersion: string
      readonly caseCount: number
      readonly risks: readonly Risk[]
    }
  | { readonly kind: 'no-cli' }
  | { readonly kind: 'failed'; readonly reason: string }

export type EvalRunResult =
  | { readonly kind: 'completed'; readonly summary: EvalSummary }
  | ({ readonly kind: 'not-complete' } & StoppedRun)
  | { readonly kind: 'risks-changed' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'no-cli' }
  | { readonly kind: 'failed'; readonly reason: string }

export type EvalCancelResult =
  | { readonly kind: 'cancelling' }
  | { readonly kind: 'idle' }
  | { readonly kind: 'failed'; readonly reason: string }

export type EvalOpenReportResult =
  | { readonly kind: 'opened' }
  | { readonly kind: 'failed'; readonly reason: string }

export type EvalsKit = {
  readonly status: (request: EvalSkillRequest) => Promise<EvalStatus>
  readonly prepare: (request: EvalSkillRequest) => Promise<EvalPrepareResult>
  readonly run: (request: EvalRunRequest) => Promise<EvalRunResult>
  readonly openReport: (
    request: EvalSkillRequest,
  ) => Promise<EvalOpenReportResult>
  readonly cancel: () => Promise<EvalCancelResult>
}
