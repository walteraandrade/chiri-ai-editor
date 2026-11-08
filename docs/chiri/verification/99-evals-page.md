# Verification: Evals page

Issue [#99](https://github.com/walteraandrade/chiri-ai-editor/issues/99), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Evals page). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `CHIRI_DEV_PORT=5311 CHIRI_CDP_PORT=9311 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9311`. Claude CLI 2.1.319, model `haiku`, 1 run, cost limit 0.3.

**Checks that used `CHIRI_DEV_PICK_FILE`:** adding the throwaway skills folder to the Library (Add) and opening a Markdown file outside the Library (Open). Everything else was clicks on the page, the dialog and the Library. A few clicks went through `eval` on the page (agent-browser's refs were too slow to find in a Library of 30 Skills); the same handlers ran.

Throwaway skills in the session scratchpad, never `~/.claude/skills`: `status-tag` (two Evals: `status-line` with a `regex` and a `tool_used: Skill` grader, `plain` "2 + 2") and `quiet` (no Evals), plus `note.md` outside the Library.

**Before** is the parent commit (`ceaf1c4`) run from its own `git worktree` against the same user data folder, so it read the last run the After build wrote. Its heading font differs from After: that worktree symlinks `node_modules`, and Vite refused the font files outside the worktree.

| Check | Result |
|---|---|
| Before: the Eval panel inside the Library, 288px wide, with the table squeezed ("statu…") ([99-1](img/99-1.png)) | Shown |
| Skill with a last complete run: the Evals button in the header with Open, Save, Review; the page "How this Skill performs" with the last run, Did the Skill fire?, Did it help?, the table at the column's width, Suspicious cases, cost, Open report and Run Evals ([99-2](img/99-2.png)) | Pass |
| Skill with no run: "No complete run yet" and Run Evals ([99-3](img/99-3.png)) | Pass |
| File outside the Library (`note.md`, opened with Open): no Evals button, and an open Evals page closed when the file changed ([99-4](img/99-4.png)) | Pass |
| Library of the open Skill renders no Eval panel (the Before screenshot shows what it replaced; the After screenshots show the Library with the Skill's files only) | Pass |
| Run from the page: the run dialog opened as before; Run Evals showed "Running…" with Cancel and "Running Evals. This can take a few minutes." The Evals button got `aria-busy` (Busy sweep) | Pass |
| `Esc` closed the page during the run: the run kept going, the button kept `aria-busy`, polling continued | Pass |
| Run ended with the page closed: toast "Evals for status-tag finished" with Show ([99-6](img/99-6.png)); Show opened the page | Pass |
| Another Skill's page during a run (`quiet`): the button kept the sweep, the page says "Evals are running for status-tag. One run at a time." and Run Evals is disabled ([99-5](img/99-5.png)). When the run ended, polling re-enabled Run Evals with no reload | Pass |
| Page of a Skill other than the running one when it ended: the toast was not seen (it may have gone between two polls of my script); the code path is the one without Show | Not seen |
| Editing the text during a run | Not shown in the window; the run state lives in the App and keys on the Skill's path, which an edit does not change |

Covered by tests: `page-mode.test.ts` (opening one page closes the one before, `Esc` and close go back to the text, Version steps ignored on the Evals page, a Version that is gone and an unavailable Evals page fall back to the text), `ended.test.ts` (the end-of-run texts), `library-view.test.ts` (`skillOfFile`), and `handlers.test.ts` (`evals:status` names the running Skill in the status of another Skill, and goes back to `null`).

## Runs

| Run | Runs per Arm | Cost (US$, the CLI's figure) |
|---|---|---|
| 1, from the page | 1 | 0.0052 |
| 2, page closed with `Esc`, other Skill's page opened | 1 | not read, replaced by run 3 (about 0.005) |
| 3, page closed with `Esc`, toast Show | 1 | 0.0051 |
| Total | | about 0.0153 |
