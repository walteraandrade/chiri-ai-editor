# Verification: Eval run, cancel and outcomes

Issue [#88](https://github.com/walteraandrade/chiri-ai-editor/issues/88), [ADR 0018](../adr/0018-skill-evals-through-claude-cli.md) (Results). Checked on 2026-11-07 in the Electron build: `CHIRI_DEV_PORT=5388 CHIRI_CDP_PORT=9388 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9388`. Claude CLI 2.1.319, model `haiku`, cost limit 0.3.

**Checks that used `CHIRI_DEV_PICK_FILE`:** only adding the throwaway skills folder to the Library (Add). Everything else was clicks in the panel and dialog.

Throwaway skills lived in the session scratchpad: `cancel-skill` (one `greet` Eval, regex `PINEAPPLE`, later copied to `greet2` and `greet3`) and `empty-skill`.

| Check | Result |
|---|---|
| A complete run first (1 Eval, 1 run): `greet` 1/1 with, 0/1 without, cost about US$0.0027 | Pass |
| Two more Evals added, then a run with 5 runs per Arm. While it runs, the panel shows `Running…` and a Cancel button; one `claude plugin eval` process and one `chiri-eval-*` Stage exist ([88-1](img/88-1.png)) | Pass |
| Cancel clicked mid-run: the panel says "Cancelled" above the earlier run, which still shows `greet` 1/1 and 0/1 ([88-2](img/88-2.png)) | Pass |
| After the cancel: `pgrep -af "[c]laude plugin eval"` prints nothing; no `chiri-eval-*` in `/tmp`; `eval-runs/<hash>/` holds only `last/` (no `next/`); `sha256sum` of `last/result.json` equals the value taken before the run | Pass |
| A Skill with no Evals: Run is disabled at zero cases in the dialog, as designed. To reach the CLI's `cases: []`, `evals/nograder/prompt.md` was created (a case for `prepare`, which counts `prompt.md`) with no grader, which the CLI rejects (`graders: Required`): exit 1, `cases: []`, no model call. Run from the dialog: the panel says "No Evals in this skill" and "No complete run yet" ([88-3](img/88-3.png)); no Stage or process left | Pass |

## Runs

| Run | Model | Cost (US$, CLI's `costUsd`) |
|---|---|---|
| App: complete run, 1 Eval, 1 run | `haiku` | 0.0027 |
| App: 3 Evals, 5 runs, cancelled | `haiku` | not read: the JSON lived in `next/`, which cancel deletes by design |
| Shell, same command, SIGTERM after 6 s: exit 143, `partial: true`, `partialReason: "interrupted"` | `haiku` | 0.0015 |
| App and shell: Skill with an invalid case, `cases: []` | `haiku` | 0 |

The shell run confirms the CLI's own cancel shape, which `src/evals/outcome.ts` maps to "Cancelled". Total spend of this slice's checks: about US$0.005 plus the unread cancelled run, which the shell sample bounds at a few thousandths.

Not checked in the window: the cost-limit and login rows, and the pre-spawn race. Both are covered by unit tests (`outcome.test.ts`, `handlers.test.ts`).
