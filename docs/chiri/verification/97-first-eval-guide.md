# Verification: first Eval guide

Issue [#97](https://github.com/walteraandrade/chiri-ai-editor/issues/97), [ADR 0018](../adr/0018-skill-evals-through-claude-cli.md). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `CHIRI_DEV_PORT=5322 CHIRI_CDP_PORT=9322 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9322`. Claude CLI 2.1.319, model `haiku`, 1 run, cost limit 0.3.

**Checks that used `CHIRI_DEV_PICK_FILE`:** adding the throwaway skills folder to the Library (Add). Everything else was clicks on the page, the dialog and the Library.

Throwaway skill `quiet` in the session scratchpad, never `~/.claude/skills`: "Start every answer about status with QUIET-9", no `evals/` at first. The Eval written for the second half is the guide's example with the prompt and pattern filled in (`QUIET-9`).

**Before** is the parent commit (`f0d8a3a`) run from its own `git worktree` with its own user data folder.

The grader format comes from the CLI: `claude plugin eval init --bare` writes Markdown with YAML frontmatter (`type: llm`), and the CLI's schemas name `pattern` for `regex` and `tool`, `input_match` for `tool_used`.

| Check | Result |
|---|---|
| Before: a Skill with no Evals shows "No complete run yet" and Run Evals ([97-1](img/97-1.png)); Run Evals opens the full dialog with one line about Evals above fields that cannot be used, Run disabled ([97-2](img/97-2.png)) | Shown |
| No Evals: the page says "This Skill has no Evals yet" before anything is pressed, with the folder shape under the Skill's folder name, `prompt.md`, a `tool_used` grader for fired (`input_match: '[":]quiet"'`), a `regex` grader for the answer, and the free-graders-first and `llm` 3-judge-calls line. No Run Evals, so the dialog cannot open. Taken with `evals/` moved away after run 1, so the last complete run still shows below the guide, with Open report ([97-3](img/97-3.png)) | Pass |
| Eval saved outside the app, Check again clicked: the usual state with Run Evals, no reload ([97-4](img/97-4.png)) | Pass |
| `evals/` moved away, Evals page closed and opened again: the guide is back. Moved back, Check again: Run Evals again | Pass |
| Eval run on the guide's Eval: fired 1/1, 1/1 with the Skill, 0/1 without, "Passes 100 points more often with the Skill". The example is a format the CLI runs | Pass |
| Review round 1, rechecked after the fixes: run 2 with the anchored `input_match: '[":]quiet"'` still counts as fired, 1/1 ([97-5](img/97-5.png)) | Pass |
| Evals deleted between the page's status and Run Evals: `prepare` returns 0 Evals, the dialog does not open and the guide shows (`settleAsk` in `dialog-state.ts`, tested; not done in the window) | By test |

Found during the check and fixed: closing and opening the Evals page did not read the status again, so a saved Eval showed only after switching Skills. The page now refreshes when it opens.

Review round 1 fixed: the tree used the frontmatter `name` where the folder name belongs; `input_match` was unanchored, so a Skill `pr` would count as fired for `pr-format`; the zero-Evals answer of `prepare` moved into the pure `settleAsk`.

Covered by tests: `first-eval.test.ts` (folder shape, grader types, `input_match` escaped, anchored and matching only that Skill, a valid sample pattern, quotes in YAML), `dialog-state.test.ts` (`settleAsk`), `stage.test.ts` (`countEvals`), `handlers.test.ts` (`evals:status` returns `caseCount`).

## Runs

| Run | Runs per Arm | Cost (US$, the CLI's figure) |
|---|---|---|
| 1, guide's Eval | 1 | 0.0052 |
| 2, review recheck, anchored `input_match` | 1 | 0.0045 |
| Total | | 0.0097 |
