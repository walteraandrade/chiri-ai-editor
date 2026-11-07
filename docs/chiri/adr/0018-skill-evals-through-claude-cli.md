# 0018. Skill Evals run through the Claude CLI

- Status: Accepted (2026-11-07), proposed 2026-11-05; Electron build only ([0016](0016-web-and-electron-builds.md))
- Source: maintainer request (an evals runtime for skills); the maintainer chose the CLI over an in-app runner on OpenRouter. Facts below come from a spike on `claude` 2.1.317 with throwaway skills, about US$0.012 by the CLI's own figures, and from a survey of how other tools show skill and prompt evals.

## Context

A skill is hard to judge by reading it. An Eval gives an agent a prompt, with the skill and without it, and a judge checks the answer against written criteria.

`claude plugin eval` already does this, with the real agent. What the spike saw:

- It accepts a plain skill folder (`<root>/<name>/SKILL.md` plus `evals/`), with no plugin manifest. The skill loads as `<name>:<name>`. The [docs](https://code.claude.com/docs/en/plugin-evals.md) only promise a folder with a manifest.
- Cases are Markdown: `evals/<case>/prompt.md` and `evals/<case>/graders/*.md`. The app already edits Markdown ([0014](0014-skills-on-disk.md)), and the Library's default depth lists these files.
- Each arm runs with a temporary `HOME` and `cwd`. The maintainer's skills and `CLAUDE.md` did not appear in the traces, so the arm without the skill is clean.
- It runs with only `HOME` and `PATH` in the environment.
- **Bash is off.** A case that lists `Bash` in `allowed_tools` still gets no Bash; only `--allow-tools` grants it. A skill that needs its scripts scores low.
- **A folder's `hooks/hooks.json` runs.** A `SessionStart` hook wrote a file outside the run's temporary folders, with `--trust-plugin` and no other flag. The CLI's help says its sandbox is not a guarantee.
- By default it publishes the report to claude.ai and writes results inside the skill's `evals/`.
- Cancelling with `SIGTERM` leaves no process behind and still writes the JSON, with `partial: true`.

Traps in the JSON (`schemaVersion: 1`):

- `runsPerCase` said 3 on a run with `--runs 1`. Count the arms' entries instead.
- A cancelled run said `casesPassed: 1` with `overallScore: 0`.
- No cases: exit 1, and a JSON with `cases: []`. `--max-cost-usd` hit: exit 2, per the help (not run in the spike).

## Decision

- **Eval:** one case folder under the skill's `evals/`, on disk, in the CLI's format. The app adds no format of its own and keeps no copy ([0014](0014-skills-on-disk.md)).
- **Eval run:** the user asks for it ([0004](0004-user-triggered-ai-and-review-pass.md)), one skill at a time, one run at a time. The main process spawns the CLI.
- **Where the code lives:**
  - `src/evals/`, pure and tested first: `report.ts` (the Adapter below), `signals.ts` (what the panel shows), `risks.ts` (what the dialog warns about), `command.ts` (the command line).
  - `electron/main/evals/`: `find-claude.ts`, `stage.ts`, `runner.ts`, `handlers.ts`, `register.ts`, following `electron/main/library/`.
  - `electron/api.ts`: `evals:prepare`, `evals:run`, `evals:cancel`.
  - The Electron kit gets an `evals` capability; the Web kit's is `null`, and the panel does not show.
  - The runner sits behind a port. Tests use a fake that returns recorded JSON and never calls the model.
- **Two steps, prepare then run.** `evals:prepare` stages the skill and returns the CLI's version, the number of cases and the risks. `evals:run` stages again and refuses if the risks changed since prepare, so the dialog never shows a stale list.
- **The CLI's report is translated at one seam (Adapter).** `parseEvalReport` turns the JSON into the app's own type with `zod`, ignores fields it does not know, counts the arms and never shows a pass for a partial run. Any other `schemaVersion` is refused with a message that names the CLI's version.
- **A stage, not the real folder.** The run works on a temporary copy of the skill, without `hooks/`, `.claude-plugin/`, `.mcp.json`, `.lsp.json`, `settings.json`, `agents/` and `commands/`, following no link out of the folder. The real folder cannot get results, and the hook above cannot fire.
- **The command line is fixed, built by a pure function:** `plugin eval . --trust-plugin --no-publish --threshold 0 --max-cost-usd <n> --runs <n> --model=<m> --json <file> --output-dir <dir>`, with `cwd` on the stage. Never `--allow-tools`, `--scaffold`, `--allow-real-servers` or `--mocks off`.
- **Results never live in the stage.** The main process picks `<file>` and `<dir>` under `<userData>/eval-runs/<skill key>/next/`, where the skill key is a hash of the skill's real path (two roots can hold the same folder name). The stage is deleted when the run ends, cancelled or not.
- **The request is `{ skillPath, runs, model, maxCostUsd }`, strict.** The main process checks that the real path is a skill in the Library, as New skill does with its root. The renderer sends no flags or paths to write. The other fields are checked too, because each lands in argv:
  - `model`: starts with a letter, then only letters, digits, `.` and `-`. A value like `--allow-tools` is refused, and `--model=<m>` keeps it one argument anyway.
  - `runs`: an integer from 1 to 5.
  - `maxCostUsd`: a number above 0, at most 5.
- **Only `HOME` and `PATH` reach the CLI.** `ANTHROPIC_API_KEY` must not, or the run stops using the maintainer's Claude login. `OPENROUTER_API_KEY` must not either.
- **Finding the CLI:** `PATH`, then `~/.local/bin/claude`. A window opened from the desktop may have a short `PATH`. Not found is a state of the panel, not an error.
- **Each run asks first.** A dialog names the skill, what a run can reach, the cost limit and the risks `risks.ts` finds on the stage: a `hooks` frontmatter field, `` !`command` `` lines, and anything the stage left out. This is the trust the CLI's own prompt would ask for, so `--trust-plugin` is passed only after it. The dialog does not call the run isolated.
- **Fired and helped are two answers.** "Did the skill fire?" comes from `tool_used: Skill` in the arm with the skill. "Did it help?" compares the two arms' passes. A skill can fire and not help, or help without a case that checks it fired.
- **Counts, not only percentages.** The panel shows passes as counts per arm (`2/3` with, `1/3` without). With 1 to 3 runs a percentage looks more certain than it is. Cost is the CLI's figure, shown as an estimate.
- **Suspicious cases are flagged, not scored away.** A case that passes in both arms does not tell the arms apart. One that fails in both is likely broken. One whose runs disagree is noisy. The panel names each kind; it does not drop them from the score.
- **The CLI's `report.html` opens from the panel** in the first slice. The panel shows the summary; the report keeps the traces.
- **The run reads what is saved.** Agents see the disk, so the Eval measures the disk. With unsaved text, the panel says so before the run.
- **Results:** the last complete run per skill, in `<userData>/eval-runs/<skill key>/last/`. Only a run that exits 0 or 1 with a JSON that parses and `partial: false` replaces `last/` with `next/`. Every other outcome leaves `last/` as it was, deletes `next/`, and the panel shows why above the last complete run:
  - cancelled (`partial: true`, `interrupted`, exit 130 or 143): "Cancelled".
  - cost limit (`cost_ceiling`, exit 2): "Stopped at the cost limit", with the limit.
  - login (`auth_failed`, exit 2): "Claude is not logged in".
  - another `schemaVersion`, or a JSON that does not parse: the Adapter's message, with the CLI's version.
  - no cases (exit 1, `cases: []`): "No Evals in this skill".
- **Version against Version, in a second slice (Strategy).** The baseline is a choice: no skill (the CLI's `with-without`), or an older Version of `SKILL.md` from History ([0015](0015-history-in-sqlite.md)). For a Version, two stages run with `--ablation none` and the app compares them. History keeps only `SKILL.md`, so the older stage uses today's other files, and the panel says so.
- **Records:** the run's cost goes to [ai-costs.md](../ai-costs.md) from the JSON, because `window.__aiCalls` does not see the CLI. It goes in its own table, Eval runs, and stays out of the US$5 running total: that total is the OpenRouter key's cap, and the CLI bills the maintainer's Claude login, like the Claude Code use the file already leaves out.

## Consequences

- The score comes from the real agent, for free in code: no runner, judge or isolation to maintain.
- The feature needs `claude` installed and logged in. Without it, the panel says so and the rest of the app is untouched.
- The app depends on an outside CLI's flags and JSON. The docs promise only added fields under `schemaVersion: 1`, but the command can also be switched off server-side. The Adapter and the panel make either case a message, not a wrong score.
- Runs are slow next to a Suggestion: about 8 s per arm on the spike's one-line skill, and one run of 5 cases with 3 repeats is 30 agents.
- A skill that needs Bash gets a low score. Granting it needs its own decision.
- Free graders (`regex`, `tool_used`, `tool_order`, `file_exists`) cost nothing and do not vary. An `llm` grader calls a judge 3 times per run, so it fits short answers best. Cases should reach for the free ones first.
- The main process now starts another program that runs as the user. Until now it only read and wrote files.
- The stage's exclusion list follows today's plugin layout, so a new auto-loaded folder would pass through until the list changes. The [skills docs](https://code.claude.com/docs/en/skills.md) add two ways a skill's own text can run code, a `hooks` frontmatter field and `` !`command` `` lines, and the stage does not remove them. Not yet checked: whether a stage without `hooks/` is enough, and what the agent's `Read` can reach outside the run's temporary folders. Both are acceptance checks of the first slice.

## Alternatives considered

- **Runner in the app, on OpenRouter:** no install and cheap, but a model with no tools, and a score that measures that model, not Claude Code. The maintainer chose against it.
- **An agent loop in the app, with tools:** the same power as the CLI, but the app would own a sandbox for third-party scripts.
- **Run on the real folder and trust it:** simpler, but opening a third-party skill and pressing Run would execute its hooks as the user.
- **Run the CLI in a container:** the real boundary for a third-party skill's code, but it needs a container runtime and a Claude login inside it. Left for when the risks list proves not enough.
- **`evals/evals.json` from `skill-creator`:** a known format, but the CLI does not read it, and the app does not edit JSON.
