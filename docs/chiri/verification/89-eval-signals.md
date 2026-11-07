# Verification: Eval signals, Suspicious cases and unsaved text

Issue [#89](https://github.com/walteraandrade/chiri-ai-editor/issues/89), [ADR 0018](../adr/0018-skill-evals-through-claude-cli.md) (Fired and helped, Counts, Suspicious cases, The run reads what is saved). Checked on 2026-11-07 in the Electron build: `CHIRI_DEV_PORT=5389 CHIRI_CDP_PORT=9389 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9389`. Claude CLI 2.1.319, model `haiku`, cost limit 0.3.

**Checks that used `CHIRI_DEV_PICK_FILE`:** only adding the throwaway skills folder to the Library (Add). Everything else was clicks in the panel and dialog.

Throwaway skill `status-tag` (session scratchpad, never `~/.claude/skills`), three Evals:

- `status-line`: the Skill says to start status updates with `ZEBRA-7`. Graders: `regex` `ZEBRA-7` and `tool_used: Skill` with an `input_match` on `status-tag`.
- `arithmetic`: "What is 2 + 2?", `regex` `4`. Passes without the Skill too.
- `impossible`: "Say hello", `regex` `QQQ-NEVER`. Never passes.

| Check | Result |
|---|---|
| Run 1 (2 runs per Arm, cost about US$0.0163): "Did the Skill fire?" 2/2 runs with the Skill; "Did it help?" 4/6 passes with, 2/6 without. Table: `arithmetic` 2/2 and 2/2, `impossible` 0/2 and 0/2, `status-line` fired 2/2, 2/2 with, 0/2 without. Suspicious cases: `arithmetic` passes with and without the Skill, `impossible` fails with and without; "Still counted in the totals" ([89-1](img/89-1.png)) | Pass |
| `SKILL.md` edited in the window, not saved: the panel says "Unsaved text in SKILL.md. A run reads what is saved on disk." above Run Evals ([89-2](img/89-2.png)) | Pass |
| Run Evals clicked with the unsaved text: the dialog repeats it and adds "Save first to measure your edits." Run stays enabled ([89-3](img/89-3.png)) | Pass |
| Dialog cancelled, another file of the Skill opened (`SKILL.md` no longer the open Document): the notice stays, from the unsaved text the app keeps per file ([89-4](img/89-4.png)) | Pass |
| Run 2 (3 runs per Arm, with the unsaved text, so the disk text ran; cost about US$0.0250): fired 3/3, 6/9 with, 3/9 without, same two Suspicious cases ([89-5](img/89-5.png)) | Pass |
| "Runs disagree": no case was noisy in either run (free graders do not vary), so it was not seen in the window. Covered by `signals.test.ts` | Not seen live |

## Runs

| Run | Runs per Arm | Cost (US$, the CLI's figure) |
|---|---|---|
| 1 | 2 | 0.0163 |
| 2 | 3 | 0.0250 |
| Total | | 0.0413 |
