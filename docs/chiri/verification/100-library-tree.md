# Verification: Library tree

Issue [#100](https://github.com/walteraandrade/chiri-ai-editor/issues/100), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Library, tree and keyboard). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `HOME=<scratch>/fx/home CHIRI_DEV_PORT=5312 CHIRI_CDP_PORT=9312 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9312`. Keys went through `agent-browser press` (Tab, arrows, letters, Home, End, Space, Enter, Escape, Delete); state was read with `eval` on `document.activeElement` (`role`, `aria-level`, `aria-expanded`, `aria-current`).

**Checks that used `CHIRI_DEV_PICK_FILE`:** Add (a throwaway project folder of Skills). Everything else was keys. A few focus moves went through `eval` (`element.focus()` on the roving-tabindex item, the same element Tab lands on) to get back into the tree after a click on Add or a Cancel, since Tab counts depend on where the pointer left the focus. Dialog buttons (Cancel, Discard) were clicked with `find`.

Fixture, all in the session scratchpad, never the real `~/.claude/skills` (`HOME` pointed at a temp dir): 19 Skills (`alpha` to `papa`, `pdf-processing` through the symlink `pdf-link`, `pr-format` with two Evals under `evals/` with Markdown and JSON graders plus `forms.md` and `run.sh`, `zulu`), a second root `~/.agents/skills` that does not exist, and a project folder with `proj-skill` and a second symlink to `pdf-processing`.

**Before** is the parent commit (`363ecdf`) run from its own `git worktree`, against the same fixture and a separate user data folder ([100-1](img/100-1.png)). The worktree was removed afterwards.

| Check | Result |
|---|---|
| Before: every Skill shows its name and two lines of description; the open Skill lists its files as flat rows such as `evals/bugfix-evidence/graders/befo…`, cut off ([100-1](img/100-1.png)) | Shown |
| Roles: `tree`, `treeitem` with `aria-level` 1 to 6, `aria-expanded` on nodes only, `group` around children; the symlinked `pdf-processing` is listed once although `pdf-link` and `pdf-again` point to it (snapshot). A treeitem's name includes its count: `~/.claude/skills · 19` | Pass |
| Tab order from the page start: New, Refresh, Add, then the tree (four Tabs) | Pass |
| The tree is one Tab stop and lands on the open file. After `SKILL.md` was opened from the tree, Tab from Add landed on `SKILL.md` (`aria-current=true`). After the focus sat on `evals` and Open (through `CHIRI_DEV_PICK_FILE`) opened `forms.md`, Tab from Add landed on `forms.md`, not on `evals` | Pass |
| An expanded Skill focused (`pr-format`, with its children shown): one row outlined (`.outline-accent` count 1) and one description visible (count read with `eval`); the same with the root focused: one outline, no description ([100-2](img/100-2.png)) | Pass |
| Skill row shows its name only; the description shows under the focused Skill: `z` focused `zulu` and its description appeared ([100-3](img/100-3.png)); `Home` and `End` went to the first and last item | Pass |
| Type-ahead: `p r - f` focused `pr-format`; `z` focused `zulu`; `c h e c` focused `check.json` | Pass |
| `→` unfolds a folded node, or moves to the first child of an unfolded one; `evals` is labelled "2 Evals" and its files nest | Pass |
| `Space` on the grader `before.md`: the file opened (`aria-current=true`, text "# Grader…") and the focus stayed on the tree item ([100-4](img/100-4.png)) | Pass |
| `Enter` on it: the focus moved to the text (`document.activeElement` inside `.cm-editor`) ([100-5](img/100-5.png)) | Pass |
| `Esc` in the tree: the focus moved to the text | Pass |
| `Enter` and `Space` on `check.json` (not Markdown): nothing opened | Pass |
| Watcher refresh with the focus on `check.json`: a new Skill (`yankee`) and a new grader (`extra.md`) appeared (31 to 33 items), the focus stayed on `check.json`, and the unfolded count stayed 5 ([100-6](img/100-6.png)) | Pass |
| The focused file deleted on disk: after the refresh the focus moved to its parent folder `graders`; `↓` then moved to `before.md` and `Esc` put the cursor in the text | Pass |
| Unsaved text, keyboard only (Shift+Tab into the tree, `s k` to `SKILL.md`, `Enter`): Save / Discard / Cancel opened with Cancel focused ([100-7](img/100-7.png)). `Esc` closed it and the focus was on the `SKILL.md` tree item again. A second time, Shift+Tab to Cancel and `Enter`: the text was kept and the focus was on the tree item again. Tab to Discard and `Enter`: `SKILL.md` opened with the focus in the text | Pass |
| Add through `CHIRI_DEV_PICK_FILE` and `Delete` on the added project root were checked in the earlier pass; `Delete` now focuses the previous root and only after a successful removal (code, not rerun in the window) | Earlier pass / By code |
| Tab order with the search field and Library button, `Ctrl+B`, rail | Not in this slice (#101, #102) |

Found and fixed during the checks: `Space` left the focus in the text because opening a document always focuses the editor, so the Library puts the focus back on its item; the `Esc` handler never ran because the item stopped the keydown; after `Delete` or a cancelled prompt the focus fell to `body`; after review, the focus outline and the description were painted on every descendant of a focused node, and a refresh that removed the focused item dropped the focus to `body`.

Eval count: the listing holds real paths, so a `prompt.md` that is a link shows a path outside the Skill. The tree counts a folder under `evals/` only when its `prompt.md` is at `<Skill>/<same relative path>`, which is what `electron/main/evals/stage.ts` does with `lstat` for a plain file. A directory link inside `evals/` cannot be told apart from a real folder in the listing.

Covered by tests: `library-tree.test.ts` (nesting, `evals/` folder with its Eval count and a linked `prompt.md` not counted, a linked Skill shown once through `scanSkillRoots`, `openFileId`, unreadable and empty roots, unique ids, visible items and levels, the folders that hold the open file) and `tree-keys.test.ts` (arrows, `Home` `End`, `→` `←`, `Enter` and `Space` on files and nodes, `Delete` on a removable root only, type-ahead, which keys are handled, modifiers ignored).

No model calls, so no row in `ai-costs.md`.
