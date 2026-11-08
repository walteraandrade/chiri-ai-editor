# Verification: Library, Evals page and buttons visual refactor

No issue: the maintainer's review feedback on [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (#103–#107). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `CHIRI_DEV_PORT=5317 CHIRI_CDP_PORT=9317 CHIRI_USER_DATA_DIR=<temp dir> pnpm dev:electron`, attached with `agent-browser connect 9317`; the Web build with `pnpm dev` in `agent-browser`'s own browser. No check used `CHIRI_DEV_PICK_FILE`. The temp user data got a copy of the maintainer's `eval-runs` folder (the `pr-format` last run), so the Evals page had a run to show.

**Before** is the parent commit (`87b52a5`) run from its own `git worktree`, with the same copied run.

| Check | Result |
|---|---|
| Before: a hovered Skill shows its whole description, pushing the tree down; Evals in the header, Preferences and Model at the bottom ([1](img/visual-refactor-1.png)) | Shown |
| Open Skill: description cut at 3 lines with an ellipsis, full text in the tooltip; Evals in the Timeline row ([2](img/visual-refactor-2.png)) | Pass |
| Description unfolds 0 → 30 → 50px over 180ms; children of an opened node unfold the same way (`unfold-in, tree-fade-in` read during the open) | Pass |
| Mouse click on `SKILL.md` under an open Skill: the file opens, the Skill stays open, nothing under the pointer moves (real `mouse down`/`up`) | Pass |
| A click whose target is the children group does not fold the Skill (synthetic click on the group) | Pass |
| Keyboard focus on a closed Skill (`ArrowDown`) shows its description; hover alone does not | Pass |
| Before: Evals page as plain lines and a bare table ([3](img/visual-refactor-3.png)) | Shown |
| Evals page: meta line, Run Evals as the strong button, two boxes with meters, per-Eval table with pips, tags "runs disagree" / "fails either way" with the diagnosis in the tooltip ([4](img/visual-refactor-4.png)) | Pass |
| Before: Preferences with no AI section ([5](img/visual-refactor-5.png)) | Shown |
| Preferences: AI section with Model (Change opens the Model dialog; `Esc` closes only that dialog); the key row shows only when the key store exists (not in `pnpm dev:electron`, where the key comes from `.env`) ([6](img/visual-refactor-6.png)) | Pass |
| Quick actions: ↑ / ↓ slide both rows 35px → 0 in 260ms with no overshoot; a new row fades in (opacity 0 → 1); a deleted row folds to 0 before it leaves, with no jump after | Pass |
| Before: Web build with Preferences and Model at the bottom left ([7](img/visual-refactor-7.png)) | Shown |
| Web build: one settings button at the end of the header, no bottom buttons ([8](img/visual-refactor-8.png)) | Pass |
| Light theme: pressed and hovered quiet buttons differ (ink-strong border on pressed) | Pass |

Not checked: the key row in the installed app (`pnpm preview:electron`), and the Suggestion cards in the editor, which share `.cm-ai-button` and may be about 2px taller.

## AI calls

None. No check called the model or ran Evals.
