# Verification: Eval run against an older Version from History

Issue [#90](https://github.com/walteraandrade/chiri-ai-editor/issues/90), [ADR 0018](../adr/0018-skill-evals-through-claude-cli.md) (Version against Version). Checked on 2026-11-07 in the Electron build: `CHIRI_DEV_PORT=5390 CHIRI_CDP_PORT=9390 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9390`. Claude CLI 2.1.319, model `haiku`, cost limit 0.3.

**Checks that used `CHIRI_DEV_PICK_FILE`:** adding the throwaway skills folder to the Library (Add) and opening `SKILL.md` (Open). Everything else was clicks in the panel and dialog, a few of them through `eval` on the page (agent-browser's click did not register on the Cancel and Run Evals buttons twice; the same handlers ran from JS).

Throwaway skill `status-tag` (session scratchpad, never `~/.claude/skills`), two Evals: `status-line` (graders: `regex` `ZEBRA-7`, `tool_used: Skill`) and `plain` ("2 + 2", `regex` `4`). History got two Versions in the window: Started (without the marker line, opened from disk) and "You added 7 words" (the line "Always start the status line with ZEBRA-7." added and saved).

Real JSON with `--ablation none` (shell probe, US$0.0027): `arms` holds only `with`; `suite.ablation` is `none`; a `tool_used: Skill` grader is scored as an ordinary grader (it counts in `passed`) and still lists in `graders`, so the Fired indicator works on both sides.

| Check | Result |
|---|---|
| Dialog: "Compare against" lists No Skill and both Versions as History labels; picking the Started Version re-prepares and shows two risk lists (today's Stage, the Version's Stage), the note that the older Stage has the Version's SKILL.md and today's other files, and that the cost limit covers both runs ([90-2](img/90-2.png)) | Pass |
| Run 1 (Started Version, 2 runs, limit 0.3, cost about US$0.0109): `today` run US$0.0054, `version` run US$0.0055, both with `ablation: none`. Panel: "Compared today's SKILL.md with the Version from 06:02 PM. The older Stage uses today's other files", fired 2/2 and 2/2, "4/4 passes with today's SKILL.md, 2/4 with the Version", table `plain` 2/2 2/2, `status-line` 2/2 today, 0/2 Version; Suspicious: `plain` passes today's SKILL.md and the Version ([90-4](img/90-4.png)) | Pass |
| `last/` holds `baseline.json`, `today/` and `version/`; no `/tmp/chiri-eval-*` Stage left; no `next/` | Pass |
| Page reloaded: the panel read the same summary from disk with the baseline named | Pass |
| Cancel during the second run (5 runs): "Cancelled. Cost about US$0.0195" (first run's cost), both Stages and `next/` gone, `last/` untouched, no `claude` process left | Pass |
| Cancel during the first run (5 runs): second run never started (only `next/today` existed), "Cancelled. Cost about US$0.0024", both Stages and `next/` gone, no process | Pass |
| Run button grey in [90-2](img/90-2.png) right after picking a Version (the dialog was refreshing); enabled afterwards, and read enabled 0.5 s to 3 s after a pick in a later check | Not reproduced |

## Runs

| Run | Runs per Arm | Cost (US$, the CLI's figure) |
|---|---|---|
| Probe, `--ablation none`, shell | 1 | 0.0027 |
| 1, complete pair | 2 | 0.0109 |
| 2, cancelled in the second run | 5 | 0.0195 |
| 3, cancelled in the first run | 5 | 0.0024 |
| Total | | 0.0355 |
