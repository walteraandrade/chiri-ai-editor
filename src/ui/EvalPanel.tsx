import { summaryView } from '../evals/baseline-view'
import { caseSignals, firedOverall, helpedOverall } from '../evals/signals'
import type { EvalsKit } from '../evals/types'
import { unsavedNotice } from '../evals/unsaved'
import {
  costEstimate,
  countLabel,
  erroredText,
  stoppedText,
  suspiciousText,
} from '../evals/view'
import { formatClock } from '../history/time'
import type { Skill } from '../skills/scan-skills'
import { EvalRunDialog } from './EvalRunDialog'
import { useEvalPanel } from './use-eval-panel'
import { type SkillUnsaved, useSkillUnsaved } from './use-skill-unsaved'

type EvalPanelProps = {
  readonly evals: EvalsKit
  readonly skill: Skill
  readonly unsaved: SkillUnsaved
}

export function EvalPanel({ evals, skill, unsaved }: EvalPanelProps) {
  const {
    state,
    dialog,
    running,
    cancelling,
    message,
    refresh,
    ask,
    pick,
    close,
    run,
    cancel,
    openReport,
  } = useEvalPanel(evals, skill.realPath)
  const unsavedFiles = useSkillUnsaved(skill, unsaved)
  const notice = unsavedNotice(unsavedFiles.names)
  const askAfterCheck = async () => {
    await unsavedFiles.check()
    await ask()
  }
  const checking = unsavedFiles.checking
  const last = state.status === 'ready' ? state.last : null
  const signals = last === null ? [] : last.cases.map(caseSignals)
  const suspicious = signals.filter(({ suspicious }) => suspicious.length > 0)
  const errored = signals.filter(({ errored: count }) => count > 0)
  const fired = last === null ? null : firedOverall(last.cases)
  const helped = last === null ? null : helpedOverall(last.cases)
  const view = summaryView(last?.baseline ?? { kind: 'none' }, (at) =>
    formatClock(at, Date.now()),
  )
  const firedSecond =
    last === null || view.firedSides === 1
      ? null
      : firedOverall(last.cases, 'second')

  return (
    <section
      aria-label={`Evals for ${skill.name}`}
      className="mt-1 border-hairline border-t px-3 py-2 pl-7 text-xs"
    >
      <h4 className="font-medium text-ink-muted">Evals</h4>
      {state.status === 'loading' ? (
        <p role="status" className="mt-1 text-ink-faint">
          Looking for the Claude CLI…
        </p>
      ) : null}
      {state.status === 'no-cli' ? (
        <p className="mt-1">
          The Claude CLI was not found on PATH or in ~/.local/bin. Install it
          and log in to run Evals.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void refresh()}
          >
            Check again
          </button>
        </p>
      ) : null}
      {state.status === 'failed' ? (
        <p role="alert" className="mt-1 text-danger">
          {state.reason}.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </p>
      ) : null}
      {message === null ? null : (
        <p role="alert" className="mt-1 text-danger">
          {message}
        </p>
      )}
      {state.status === 'ready' ? (
        <>
          {state.stopped === null ? null : (
            <p role="status" className="mt-1 text-ink-strong">
              {stoppedText(state.stopped)}
            </p>
          )}
          {last === null ? (
            <p className="mt-1 text-ink-faint">No complete run yet</p>
          ) : (
            <div className="mt-1">
              <p className="text-ink-faint">
                Last complete run, {new Date(last.startedAt).toLocaleString()}
              </p>
              {view.comparedNote === null ? null : (
                <p className="text-ink-faint">{view.comparedNote}</p>
              )}
              <dl className="mt-1 space-y-1">
                <div>
                  <dt className="text-ink-muted">Did the Skill fire?</dt>
                  <dd className="text-ink-strong">
                    {view.firedText(fired, firedSecond)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Did it help?</dt>
                  <dd className="text-ink-strong">{view.helpedText(helped)}</dd>
                  {helped === null || helped.leftOut === 0 ? null : (
                    <dd className="text-ink-faint">
                      {view.leftOut(helped.leftOut)}.
                    </dd>
                  )}
                </div>
              </dl>
              <table className="mt-2 w-full">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th scope="col" className="py-0.5 pr-2 font-normal">
                      Eval
                    </th>
                    <th scope="col" className="py-0.5 pr-2 font-normal">
                      Fired
                    </th>
                    <th scope="col" className="py-0.5 pr-2 font-normal">
                      {view.columns.first}
                    </th>
                    <th scope="col" className="py-0.5 font-normal">
                      {view.columns.second}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.cases.map((item, index) => (
                    <tr key={item.name}>
                      <td className="max-w-0 truncate py-0.5 pr-2">
                        {item.name}
                      </td>
                      <td className="py-0.5 pr-2">
                        {signals[index]?.fired == null
                          ? '–'
                          : countLabel(signals[index].fired)}
                      </td>
                      <td className="py-0.5 pr-2">
                        {item.with.total === 0 ? '–' : countLabel(item.with)}
                      </td>
                      <td className="py-0.5">
                        {item.without === null ? '–' : countLabel(item.without)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-hairline border-t font-medium text-ink-strong">
                    <th
                      scope="row"
                      className="py-0.5 pr-2 text-left font-medium"
                    >
                      All
                    </th>
                    <td className="py-0.5 pr-2">
                      {fired === null ? '–' : countLabel(fired)}
                    </td>
                    <td className="py-0.5 pr-2">
                      {helped === null ? '–' : countLabel(helped.with)}
                    </td>
                    <td className="py-0.5">
                      {helped === null ? '–' : countLabel(helped.without)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {errored.length === 0 ? null : (
                <ul className="mt-2 space-y-0.5 text-ink-faint">
                  {errored.map((item) => (
                    <li key={item.name}>
                      <span className="font-medium text-ink-strong">
                        {item.name}
                      </span>{' '}
                      {erroredText(item.errored)}
                    </li>
                  ))}
                </ul>
              )}
              {suspicious.length === 0 ? null : (
                <div className="mt-2">
                  <h5 className="text-ink-muted">Suspicious cases</h5>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                    {suspicious.flatMap((item) =>
                      item.suspicious.map((kind) => (
                        <li key={`${item.name}-${kind}`}>
                          <span className="font-medium text-ink-strong">
                            {item.name}
                          </span>{' '}
                          {suspiciousText(kind, view.labels)}
                        </li>
                      )),
                    )}
                  </ul>
                  <p className="mt-0.5 text-ink-faint">
                    Still counted in the totals.
                  </p>
                </div>
              )}
              <p className="mt-1 text-ink-faint">
                Cost {costEstimate(last.costUsd)}, the CLI's figure.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {view.reports.map(({ part, label }) => (
                  <button
                    key={part}
                    type="button"
                    className="cm-ai-button px-2 py-0.5 text-xs"
                    onClick={() => void openReport(part)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {notice === null ? null : (
            <p role="status" className="mt-2 text-ink-strong">
              {notice}
            </p>
          )}
          <div className="mt-2">
            <button
              type="button"
              className="cm-ai-button px-2 py-0.5 text-xs"
              disabled={running || checking || dialog.status === 'preparing'}
              aria-busy={running || undefined}
              onClick={() => void askAfterCheck()}
            >
              {running ? 'Running…' : 'Run Evals'}
            </button>
            {running ? (
              <button
                type="button"
                className="cm-ai-button ml-2 px-2 py-0.5 text-xs"
                disabled={cancelling}
                onClick={() => void cancel()}
              >
                {cancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {running ? (
        <p role="status" className="mt-1 text-ink-faint">
          Running Evals. This can take a few minutes.
        </p>
      ) : null}
      {dialog.status === 'confirm' ? (
        <EvalRunDialog
          skillName={skill.name}
          unsavedNotice={notice}
          prepared={dialog.prepared}
          baseline={dialog.baseline}
          refreshing={dialog.refreshing}
          onPick={(baseline) => void pick(baseline)}
          onRun={(settings) => void run(settings, dialog.baseline)}
          onClose={close}
        />
      ) : null}
    </section>
  )
}
