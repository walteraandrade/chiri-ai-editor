import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { type RunBaseline, versionOptionLabel } from '../evals/baseline'
import { runCopy } from '../evals/baseline-view'
import { firstRunLimit, LIMIT_TOO_SMALL } from '../evals/limits'
import { riskLines } from '../evals/risks'
import {
  checkEvalSettings,
  DEFAULT_EVAL_SETTINGS,
  type EvalSettings,
  MAX_COST_LIMIT_USD,
  MAX_RUNS,
  MIN_RUNS,
} from '../evals/settings'
import type { EvalPrepareResult } from '../evals/types'
import { formatClock } from '../history/time'

type Prepared = Extract<EvalPrepareResult, { kind: 'ready' }>

type EvalRunDialogProps = {
  readonly skillName: string
  readonly prepared: Prepared
  readonly unsavedNotice: string | null
  readonly baseline: RunBaseline
  readonly refreshing: boolean
  readonly onPick: (baseline: RunBaseline) => void
  readonly onRun: (settings: EvalSettings) => void
  readonly onClose: () => void
}

const NONE_VALUE = 'none'

const selectValue = (baseline: RunBaseline): string =>
  baseline.kind === 'none' ? NONE_VALUE : String(baseline.versionId)

const baselineOf = (value: string): RunBaseline =>
  value === NONE_VALUE
    ? { kind: 'none' }
    : { kind: 'version', versionId: Number(value) }

export function EvalRunDialog({
  skillName,
  prepared,
  unsavedNotice,
  baseline,
  refreshing,
  onPick,
  onRun,
  onClose,
}: EvalRunDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const runsId = useId()
  const modelId = useId()
  const costId = useId()
  const baselineId = useId()
  const [runs, setRuns] = useState(String(DEFAULT_EVAL_SETTINGS.runs))
  const [model, setModel] = useState(DEFAULT_EVAL_SETTINGS.model)
  const [cost, setCost] = useState(String(DEFAULT_EVAL_SETTINGS.maxCostUsd))
  const settings: EvalSettings = {
    runs: Number(runs),
    model,
    maxCostUsd: Number(cost),
  }
  const copy = runCopy(baseline.kind)
  const problems = [
    ...checkEvalSettings(settings),
    ...(baseline.kind === 'version' &&
    Number.isFinite(settings.maxCostUsd) &&
    settings.maxCostUsd > 0 &&
    firstRunLimit(settings.maxCostUsd) === null
      ? [LIMIT_TOO_SMALL]
      : []),
  ]
  const lines = riskLines(prepared.risks)
  const olderLines =
    prepared.baselineRisks === null ? null : riskLines(prepared.baselineRisks)
  const noCases = prepared.caseCount === 0
  const ready = problems.length === 0 && !noCases && !refreshing
  const now = Date.now()
  const formatTime = (at: number): string => formatClock(at, now)
  const versions = prepared.versions.toReversed()

  useEffect(() => {
    const element = dialog.current
    if (element !== null && !element.open) element.showModal()
  }, [])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (ready) onRun(settings)
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="eval-run-title"
      className="m-auto max-h-[calc(100vh-3rem)] w-[min(34rem,calc(100vw-3rem))] overflow-y-auto border border-hairline bg-raised p-6 text-ink backdrop:bg-canvas"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <form onSubmit={submit}>
        <h2
          id="eval-run-title"
          className="font-semibold text-base text-ink-strong"
        >
          Run Evals for {skillName}
        </h2>
        <p className="mt-2 text-sm">
          {noCases
            ? 'This Skill has no Evals. Add a folder under evals/ with a prompt.md and a graders/ folder.'
            : copy.intro(prepared.caseCount, prepared.claudeVersion)}
        </p>
        <label
          htmlFor={baselineId}
          className="mt-4 mb-1 block font-medium text-ink-muted text-xs"
        >
          Compare against
        </label>
        <select
          id={baselineId}
          value={selectValue(baseline)}
          disabled={refreshing}
          className="cm-ai-bubble-input w-full"
          onChange={(event) => onPick(baselineOf(event.target.value))}
        >
          <option value={NONE_VALUE}>No Skill</option>
          {versions.map((version) => (
            <option key={version.id} value={String(version.id)}>
              {versionOptionLabel(
                prepared.versions,
                version,
                formatTime,
                prepared.sameAsSaved.includes(version.id),
              )}
            </option>
          ))}
        </select>
        {copy.stageNote === null ? null : (
          <p className="mt-1 text-ink-faint text-xs">{copy.stageNote}</p>
        )}
        <h3 className="mt-4 font-medium text-ink-muted text-xs">
          What a run can reach
        </h3>
        <p className="mt-1 text-sm">
          The agent runs as you, on your Claude login, in a temporary copy of
          the Skill. That copy leaves out hooks, the plugin manifest, MCP and
          LSP config, settings, agents and commands. The CLI gives each run its
          own home and working folder, but it says its sandbox is not a
          guarantee, so what the agent's tools can read on this machine is not
          limited by Chiri. Hard links to files outside the folder are copied as
          content.
        </p>
        <h3 className="mt-4 font-medium text-ink-muted text-xs">
          Found on this Skill
        </h3>
        {refreshing ? (
          <p role="status" className="mt-1 text-ink-faint text-sm">
            Checking this Version…
          </p>
        ) : (
          <>
            <RiskList title={copy.todayTitle} lines={lines} />
            {olderLines === null ? null : (
              <RiskList title={copy.olderTitle} lines={olderLines} />
            )}
          </>
        )}
        {unsavedNotice === null ? null : (
          <p role="status" className="mt-4 text-ink-strong text-sm">
            {unsavedNotice} Save first to measure your edits.
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor={runsId}
              className="mb-1 block font-medium text-ink-muted text-xs"
            >
              Runs per Arm
            </label>
            <input
              id={runsId}
              type="number"
              min={MIN_RUNS}
              max={MAX_RUNS}
              step={1}
              value={runs}
              className="cm-ai-bubble-input w-full"
              onChange={(event) => setRuns(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={modelId}
              className="mb-1 block font-medium text-ink-muted text-xs"
            >
              Model
            </label>
            <input
              id={modelId}
              type="text"
              value={model}
              spellCheck={false}
              autoComplete="off"
              className="cm-ai-bubble-input w-full"
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={costId}
              className="mb-1 block font-medium text-ink-muted text-xs"
            >
              Cost limit (US$)
            </label>
            <input
              id={costId}
              type="number"
              min={0}
              max={MAX_COST_LIMIT_USD}
              step={0.1}
              value={cost}
              className="cm-ai-bubble-input w-full"
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
        </div>
        {problems.length === 0 ? null : (
          <ul className="mt-2 space-y-0.5 text-danger text-xs">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-ink-faint text-xs">
          {copy.limitNote} A run reads what is saved on disk.
        </p>
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button type="button" className="cm-ai-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="cm-ai-button cm-ai-button-primary"
            disabled={!ready}
          >
            Run
          </button>
        </div>
      </form>
    </dialog>
  )
}

type RiskListProps = {
  readonly title: string | null
  readonly lines: readonly string[]
}

function RiskList({ title, lines }: RiskListProps) {
  return (
    <>
      {title === null ? null : (
        <p className="mt-2 font-medium text-ink-strong text-sm">{title}</p>
      )}
      {lines.length === 0 ? (
        <p className="mt-1 text-sm">Nothing flagged.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </>
  )
}
