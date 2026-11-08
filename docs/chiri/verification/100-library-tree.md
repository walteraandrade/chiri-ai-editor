# Verification: Library tree

Issue [#100](https://github.com/walteraandrade/chiri-ai-editor/issues/100), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Library, tree and keyboard). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `HOME=<scratch>/fx/home CHIRI_DEV_PORT=5312 CHIRI_CDP_PORT=9312 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<file> pnpm dev:electron`, attached with `agent-browser connect 9312`. Keys went through `agent-browser press` (Tab, arrows, letters, Home, End, Space, Enter, Escape, Delete); state was read with `eval` on `document.activeElement` (`role`, `aria-level`, `aria-expanded`, `aria-current`).

**Checks that used `CHIRI_DEV_PICK_FILE`:** Add (a throwaway project folder of Skills). Everything else was keys. A few focus moves went through `eval` (`element.focus()` on the roving-tabindex item, the same element Tab lands on) to get back into the tree after a click on Add or a Cancel, since Tab counts depend on where the pointer left the focus. Dialog buttons (Cancel, Discard) were clicked with `find`.

Fixture, all in the session scratchpad, never the real `~/.claude/skills` (`HOME` pointed at a temp dir): 19 Skills (`alpha` to `papa`, `pdf-processing` through the symlink `pdf-link`, `pr-format` with two Evals under `evals/` with Markdown and JSON graders plus `forms.md` and `run.sh`, `zulu`), a second root `~/.agents/skills` that does not exist, and a project folder with `proj-skill` and a second symlink to `pdf-processing`.

**Before** is the parent commit (`363ecdf`) run from its own `git worktree`, against the same fixture and a separate user data folder ([100-1](img/100-1.png)). The worktree was removed afterwards.

| Check | Result |
|---|---|
| Before: every Skill shows its name and two lines of description; the open Skill lists its files as flat rows such as `evals/bugfix-evidence/graders/befo…`, cut off ([100-1](img/100-1.png)) | Shown |
| Roles: `tree`, `treeitem` with `aria-level` 1 to 6, `aria-expanded` on nodes only, `group` around children; the symlinked `pdf-processing` is listed once although `pdf-link` and `pdf-again` point to it (snapshot) | Pass |
| Tab order from the page start: New, Refresh, Add, then the tree (four Tabs) | Pass |
| The tree is one Tab stop and lands on the open file: after a reload with `before.md` open, the fourth Tab focused `before.md` with `aria-current=true`; with `SKILL.md` open it focused `SKILL.md` ([100-2](img/100-2.png)) | Pass |
| Skill row shows its name only; the description shows under the focused Skill: `z` focused `zulu` and its description appeared ([100-3](img/100-3.png)); `Home` and `End` went to the first and last item (`End` reached the second root) | Pass |
| Type-ahead: `p r - f` (typed within the buffer) focused `pr-format`; `z` focused `zulu` | Pass |
| `→` on a folded node unfolded it; `→` on an unfolded node moved to its first child; down to `evals` (label "2 Evals"), `bugfix-evidence`, `graders`, `before.md` by `→` and `↓` only | Pass |
| `Space` on the grader `before.md`: the file opened (`aria-current=true`, text "# Grader…") and the focus stayed on the tree item ([100-4](img/100-4.png)) | Pass |
| `Enter` on it: the focus moved to the text (`document.activeElement` inside `.cm-editor`) ([100-5](img/100-5.png)) | Pass |
| `Esc` in the tree: the focus moved to the text | Pass |
| `Enter` and `Space` on `check.json`: nothing opened, text and focus unchanged (listed, not opened) | Pass |
| Watcher refresh while the focus sat on `check.json`: a new Skill (`yankee`) and a new grader (`extra.md`) appeared (31 to 33 items), the focus stayed on `check.json`, and the unfolded count stayed 5 ([100-6](img/100-6.png)). A removal of both files did the same (33 to 31) | Pass |
| Unsaved text, `Enter` on `extra.md`: Save / Discard / Cancel asked ([100-7](img/100-7.png)); Cancel kept the text and the focus returned to the tree item; an earlier pass, Discard on `SKILL.md` opened it with the cursor in the text | Pass |
| Add through `CHIRI_DEV_PICK_FILE`: the project root appeared as a third root | Pass |
| `Delete` on that project root: "Removed …" toast, the root left the tree, and the focus moved to the previous item. `Delete` on a Skill or a file is a no-op (test only; not pressed in the window) | Pass (root), By test (others) |
| Tab order with the search field and Library button, `Ctrl+B`, rail | Not in this slice (#101, #102) |

Found and fixed during the check: `Space` left the focus in the text because opening a document always focuses the editor, so the Library puts the focus back on its item; the `Esc` handler never ran because the item stopped the keydown; after `Delete` or a cancelled prompt the focus fell to `body`.

Covered by tests: `library-tree.test.ts` (nesting, `evals/` folder with its Eval count, a Skill reached from two roots shown once, unreadable and empty roots, unique ids, visible items and levels, the folders that hold the open file) and `tree-keys.test.ts` (arrows, `Home` `End`, `→` `←`, `Enter` and `Space` on files and nodes, `Delete` on a removable root only, type-ahead, modifiers ignored).

No model calls, so no row in `ai-costs.md`.
