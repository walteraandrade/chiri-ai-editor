import { summaryView } from '../evals/baseline-view'
import {
  type CaseSignals,
  caseSignals,
  firedOverall,
  helpedOverall,
  type SuspiciousKind,
} from '../evals/signals'
import type { RunRecord, Tally } from '../evals/tally'
import { unsavedNotice } from '../evals/unsaved'
import {
  type ArmLabels,
  costEstimate,
  countLabel,
  erroredText,
  stoppedText,
  suspiciousText,
} from '../evals/view'
import { formatClock } from '../history/time'
import type { Skill } from '../skills/scan-skills'
import { EvalRunDialog } from './EvalRunDialog'
import type { useEvalPanel } from './use-eval-panel'
import { type SkillUnsaved, useSkillUnsaved } from './use-skill-unsaved'

type EvalsPageProps = {
  readonly skill: Skill
  readonly busyName: string | null
  readonly panel: ReturnType<typeof useEvalPanel>
  readonly unsaved: SkillUnsaved
}

type Mark = 'pass' | 'fail' | 'none'

const passMark = ({ passed, errored }: RunRecord): Mark =>
  errored ? 'none' : passed ? 'pass' : 'fail'

const firedMark = ({ fired, errored }: RunRecord): Mark =>
  errored || fired === null ? 'none' : fired ? 'pass' : 'fail'

const share = ({ passed, total }: Tally): number =>
  total === 0 ? 0 : passed / total

const verdict = (
  first: Tally,
  second: Tally,
  { first: today, second: other }: ArmLabels,
  versus: boolean,
): string => {
  const gap = Math.round((share(first) - share(second)) * 100)
  const size = `${Math.abs(gap)} ${Math.abs(gap) === 1 ? 'point' : 'points'}`
  const more = gap > 0 ? 'more' : 'less'
  return gap === 0
    ? versus
      ? `Same pass rate for ${today} and ${other}`
      : 'Same pass rate with and without the Skill'
    : versus
      ? `${today.charAt(0).toUpperCase()}${today.slice(1)} passes ${size} ${more} often than ${other}`
      : `Passes ${size} ${more} often ${today}`
}

const SHORT_FLAG: Readonly<Record<SuspiciousKind, string>> = {
  'passes-in-both': 'passes either way',
  'fails-in-both': 'fails either way',
  'runs-disagree': 'runs disagree',
}

function Meter({
  label,
  tally,
}: {
  readonly label: string
  readonly tally: Tally
}) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ink-muted text-xs">{label}</span>
        <span className="font-display font-semibold text-ink-strong text-xl tabular-nums">
          {countLabel(tally)}
        </span>
      </div>
      <div className="mt-1 h-1.5 border border-hairline" aria-hidden="true">
        <div
          className="h-full bg-ink-strong"
          style={{ width: `${share(tally) * 100}%` }}
        />
      </div>
    </div>
  )
}

function Pips({
  marks,
  tally,
}: {
  readonly marks: readonly Mark[]
  readonly tally: Tally | null
}) {
  if (tally === null) return <span className="text-ink-faint">–</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex gap-0.5" aria-hidden="true">
        {marks.map((mark, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: runs have no id and never reorder
            key={index}
            className={`size-2.5 border ${
              mark === 'pass'
                ? 'border-ink-strong bg-ink-strong'
                : mark === 'fail'
                  ? 'border-ink-faint'
                  : 'border-ink-faint border-dashed'
            }`}
          />
        ))}
      </span>
      <span className="text-ink tabular-nums">{countLabel(tally)}</span>
    </span>
  )
}

function Flags({
  signal,
  labels,
}: {
  readonly signal: CaseSignals | undefined
  readonly labels: ArmLabels
}) {
  if (
    signal === undefined ||
    (signal.suspicious.length === 0 && signal.errored === 0)
  )
    return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {signal.suspicious.map((kind) => (
        <span
          key={kind}
          title={suspiciousText(kind, labels)}
          className={`cursor-help border px-1.5 text-xs ${
            kind === 'fails-in-both'
              ? 'border-danger text-danger'
              : 'border-hairline text-ink-muted'
          }`}
        >
          {SHORT_FLAG[kind]}
          <span className="sr-only">: {suspiciousText(kind, labels)}</span>
        </span>
      ))}
      {signal.errored === 0 ? null : (
        <span className="border border-danger px-1.5 text-danger text-xs">
          {erroredText(signal.errored)}
        </span>
      )}
    </span>
  )
}

export function EvalsPage({ skill, busyName, panel, unsaved }: EvalsPageProps) {
  const {
    state,
    dialog,
    running,
    cancelling,
    busyWith,
    message,
    refresh,
    ask,
    pick,
    close,
    run,
    cancel,
    openReport,
  } = panel
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
    <article aria-labelledby="evals-page-title" className="pt-4 text-sm">
      <header>
        <h2
          id="evals-page-title"
          className="font-display font-semibold text-3xl text-ink-strong tracking-wide"
        >
          How this Skill performs
        </h2>
        <p className="mt-3 flex flex-wrap gap-x-2 text-ink-muted">
          <span className="text-ink-strong">{skill.name}</span>
          {last === null ? null : (
            <>
              <span aria-hidden="true">·</span>
              <span>Last run {new Date(last.startedAt).toLocaleString()}</span>
              <span aria-hidden="true">·</span>
              <span title="The CLI's figure">
                Cost {costEstimate(last.costUsd)}
              </span>
            </>
          )}
        </p>
      </header>
      {state.status === 'loading' ? (
        <p role="status" className="mt-3 text-ink-faint">
          Looking for the Claude CLI…
        </p>
      ) : null}
      {state.status === 'no-cli' ? (
        <p className="mt-3">
          The Claude CLI was not found on PATH or in ~/.local/bin. Install it
          and log in to run Evals.{' '}
          <button
            type="button"
            className="text-action"
            onClick={() => void refresh()}
          >
            Check again
          </button>
        </p>
      ) : null}
      {state.status === 'failed' ? (
        <p role="alert" className="mt-3 text-danger">
          {state.reason}.{' '}
          <button
            type="button"
            className="text-action"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </p>
      ) : null}
      {message === null ? null : (
        <p role="alert" className="mt-3 text-danger">
          {message}
        </p>
      )}
      {state.status === 'ready' ? (
        <>
          {state.stopped === null ? null : (
            <p role="status" className="mt-3 text-ink-strong">
              {stoppedText(state.stopped)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="cm-ai-button cm-ai-button-strong"
              disabled={
                running ||
                busyWith !== null ||
                checking ||
                dialog.status === 'preparing'
              }
              aria-busy={running || undefined}
              onClick={() => void askAfterCheck()}
            >
              {running ? 'Running…' : 'Run Evals'}
            </button>
            {running ? (
              <button
                type="button"
                className="cm-ai-button"
                disabled={cancelling}
                onClick={() => void cancel()}
              >
                {cancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            ) : null}
            {last === null
              ? null
              : view.reports.map(({ part, label }) => (
                  <button
                    key={part}
                    type="button"
                    className="cm-ai-button"
                    onClick={() => void openReport(part)}
                  >
                    {label}
                  </button>
                ))}
          </div>
          {notice === null ? null : (
            <p role="status" className="mt-3 text-ink-strong">
              {notice}
            </p>
          )}
          {last === null ? (
            <p className="mt-6 border border-hairline px-4 py-6 text-center text-ink-faint">
              No complete run yet. Run Evals to see how this Skill does.
            </p>
          ) : (
            <div className="mt-6">
              {view.comparedNote === null ? null : (
                <p className="mb-3 text-ink-faint text-xs">
                  {view.comparedNote}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <section
                  aria-labelledby="evals-fired"
                  className="border border-hairline p-4"
                >
                  <h3 id="evals-fired" className="text-ink-muted text-xs">
                    Did the Skill fire?
                  </h3>
                  {fired === null ? (
                    <p className="mt-2 text-ink-faint">
                      {view.firedText(null, null)}
                    </p>
                  ) : (
                    <>
                      <Meter label={view.columns.first} tally={fired} />
                      {firedSecond === null ? null : (
                        <Meter
                          label={view.columns.second}
                          tally={firedSecond}
                        />
                      )}
                      <p className="mt-3 text-ink-faint text-xs">
                        {view.firedText(fired, firedSecond)}
                      </p>
                    </>
                  )}
                </section>
                <section
                  aria-labelledby="evals-helped"
                  className="border border-hairline p-4"
                >
                  <h3 id="evals-helped" className="text-ink-muted text-xs">
                    Did it help?
                  </h3>
                  {helped === null ? (
                    <p className="mt-2 text-ink-faint">
                      {view.helpedText(null)}
                    </p>
                  ) : (
                    <>
                      <Meter label={view.columns.first} tally={helped.with} />
                      <Meter
                        label={view.columns.second}
                        tally={helped.without}
                      />
                      <p className="mt-3 text-ink-strong text-xs">
                        {verdict(
                          helped.with,
                          helped.without,
                          view.labels,
                          view.firedSides === 2,
                        )}
                      </p>
                      {helped.leftOut === 0 ? null : (
                        <p className="mt-1 text-ink-faint text-xs">
                          {view.leftOut(helped.leftOut)}.
                        </p>
                      )}
                    </>
                  )}
                </section>
              </div>
              <section aria-labelledby="evals-cases" className="mt-8">
                <h3
                  id="evals-cases"
                  className="text-ink-muted text-xs uppercase tracking-widest"
                >
                  Each Eval · {last.cases.length}
                </h3>
                <table className="mt-2 w-full table-fixed border-hairline border-t">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-ink-faint text-xs">
                      <th scope="col" className="py-2 pr-3 font-normal">
                        Eval
                      </th>
                      <th scope="col" className="py-2 pr-3 font-normal">
                        Fired
                      </th>
                      <th scope="col" className="py-2 pr-3 font-normal">
                        {view.columns.first}
                      </th>
                      <th scope="col" className="py-2 font-normal">
                        {view.columns.second}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {last.cases.map((item, index) => {
                      const signal = signals[index]
                      return (
                        <tr
                          key={item.name}
                          className="border-hairline border-t align-top"
                        >
                          <th
                            scope="row"
                            className="py-3 pr-3 text-left font-normal"
                          >
                            <span className="block break-words text-ink-strong">
                              {item.name}
                            </span>
                            <Flags signal={signal} labels={view.labels} />
                          </th>
                          <td className="py-3 pr-3">
                            <Pips
                              marks={item.runs.with.map(firedMark)}
                              tally={signal?.fired ?? null}
                            />
                          </td>
                          <td className="py-3 pr-3">
                            <Pips
                              marks={item.runs.with.map(passMark)}
                              tally={item.with.total === 0 ? null : item.with}
                            />
                          </td>
                          <td className="py-3">
                            <Pips
                              marks={(item.runs.without ?? []).map(passMark)}
                              tally={item.without}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {suspicious.length === 0 ? null : (
                  <p className="mt-2 text-ink-faint text-xs">
                    Flagged Evals still count in the totals.
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      ) : null}
      {busyWith !== null && !running ? (
        <p role="status" className="mt-3 text-ink-strong">
          Evals are running for {busyName ?? 'another Skill'}. One run at a
          time.
        </p>
      ) : null}
      {running ? (
        <p role="status" className="mt-3 text-ink-faint">
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
    </article>
  )
}
