import type { EvalsKit } from '../evals/types'
import { costEstimate, countLabel } from '../evals/view'
import type { Skill } from '../skills/scan-skills'
import { EvalRunDialog } from './EvalRunDialog'
import { useEvalPanel } from './use-eval-panel'

type EvalPanelProps = {
  readonly evals: EvalsKit
  readonly skill: Skill
}

export function EvalPanel({ evals, skill }: EvalPanelProps) {
  const {
    state,
    dialog,
    running,
    message,
    refresh,
    ask,
    close,
    run,
    openReport,
  } = useEvalPanel(evals, skill.realPath)
  const last = state.status === 'ready' ? state.last : null

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
          {last === null ? (
            <p className="mt-1 text-ink-faint">No complete run yet</p>
          ) : (
            <div className="mt-1">
              <p className="text-ink-faint">
                Last complete run, {new Date(last.startedAt).toLocaleString()}
              </p>
              <table className="mt-1 w-full">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th scope="col" className="py-0.5 pr-2 font-normal">
                      Eval
                    </th>
                    <th scope="col" className="py-0.5 pr-2 font-normal">
                      With
                    </th>
                    <th scope="col" className="py-0.5 font-normal">
                      Without
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.cases.map((item) => (
                    <tr key={item.name}>
                      <td className="max-w-0 truncate py-0.5 pr-2">
                        {item.name}
                      </td>
                      <td className="py-0.5 pr-2">{countLabel(item.with)}</td>
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
                    <td className="py-0.5 pr-2">{countLabel(last.with)}</td>
                    <td className="py-0.5">
                      {last.without === null ? '–' : countLabel(last.without)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-1 text-ink-faint">
                Cost {costEstimate(last.costUsd)}, the CLI's figure.
              </p>
              <button
                type="button"
                className="cm-ai-button mt-1 px-2 py-0.5 text-xs"
                onClick={() => void openReport()}
              >
                Open report
              </button>
            </div>
          )}
          <div className="mt-2">
            <button
              type="button"
              className="cm-ai-button px-2 py-0.5 text-xs"
              disabled={running || dialog.status === 'preparing'}
              aria-busy={running || undefined}
              onClick={() => void ask()}
            >
              {running ? 'Running…' : 'Run Evals'}
            </button>
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
          prepared={dialog.prepared}
          onRun={(settings) => void run(settings)}
          onClose={close}
        />
      ) : null}
    </section>
  )
}
