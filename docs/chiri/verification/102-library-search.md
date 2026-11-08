# Verification: Library search

Issue [#102](https://github.com/walteraandrade/chiri-ai-editor/issues/102), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Search). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11), `HOME=<scratch>/fx102/home CHIRI_DEV_PORT=5314 CHIRI_CDP_PORT=9314 CHIRI_USER_DATA_DIR=<scratch>/ud-after pnpm dev:electron -- --ozone-platform=x11`, attached with `agent-browser connect 9314`. The window is 1280px wide by default; `agent-browser set viewport` set 1440 and 900 (`innerWidth` read back). State was read with `eval` (`document.activeElement`, the panel's `hidden`, the combobox attributes, the options).

**Keys:** every key went through `agent-browser press` (CDP key events: `Control+p`, `Control+b`, `ArrowUp`, `ArrowDown`, `Enter`, `Escape`, `Tab`) or `agent-browser keyboard type`. **Focus moves through the page, not keys:** `agent-browser click ".cm-content"` to put the cursor in the text before a press; `agent-browser click` on the rail's Search button and on a result row. No `eval` moved the focus.

Fixture, in the session scratchpad, never the real `~/.claude/skills` (`HOME` pointed at a temp dir): 21 Skills, among them `pr-format`, `pr-review`, `print-setup`, `git-pr` (a word that starts with `pr`), `pdf-processing` (a word, `processing`), `deploy-notes` (`pr` only in its description) and `docs-writer` and `pr-format` with Evals (`evals/bugfix`, `evals/pr-title-case`, with `prompt.md` and `graders/before.md`), plus a missing second root `~/.agents/skills`.

**Before** is the parent commit (`42ac170`) run from its own `git worktree` (its own `pnpm install`, Electron binary linked from this checkout, own user data folder), same fixture: [102-1](img/102-1.png), the Library opened with `Ctrl+B` at 1440px: no field, one rail button. There `Ctrl+P` changed nothing (`combobox` count 0, Library still folded). The worktree was removed afterwards.

| Check | Result |
|---|---|
| Rail: two buttons. Search: `aria-label` "Search the Library", `title` "Search the Library (Ctrl+P)", `aria-keyshortcuts` `Control+P`, `Ctrl+P` visible inside it ([102-5](img/102-5.png)) | Pass |
| `Ctrl+P` from the text, Library folded: it opened and the focus was on the field (`INPUT`, `role=combobox`) | Pass |
| Type `pr`: 12 options; `aria-expanded=true`, `aria-activedescendant` the first option, which has `aria-selected=true`. Order: `pr-format`, `pr-review`, `print-setup` (names that start with `pr`, Library order), `git-pr`, `pdf-processing` (a word that starts with `pr`), then six file paths (word-start match since the review: `prompt.md` still matches `pr`) (`evals/…`, `docs-writer` then `pr-format`), then `deploy-notes`, which matches only in its description: 12 rows ([102-2](img/102-2.png)) | Pass |
| Match underlined: `<mark>` computed `text-decoration-line: underline`, on the Skill name, on the path and, for a description match, on the description | Pass |
| `↑` on the first row went to the last (`library-search-option-11`); `↓` went to the first again, then the second; wrapping both ways | Pass |
| Highlighted row, computed: `outline: 1px solid rgb(166, 161, 89)` = `--theme-accent`; background `rgb(30, 14, 63)` = `--theme-raised`; text `rgb(255, 221, 0)` = `--theme-ink`; the AI color is `rgb(246, 140, 80)` and appears nowhere on the row. In this Palette fill and raised are the same color, so the outline is what shows the row. Hairlines between rows are the raised color; `box-shadow` is not `none` on 0 elements of the page | Pass |
| Live region: one `p[role=status]`, always mounted, visually hidden; its text read "12 results" for `pr` and "No Skill or file matches zzq" for `zzq` (after review it says a fixed "No matches"; by code, not re-run). The visible no-match box is `aria-hidden`. Option ids come from the result (`library-search-option-skill%3A…pr-format`), so `aria-activedescendant` changed from `…pr-format` to `…pr-review` on `↓` and stays right if the list changes | Pass |
| No match, `zzq`: `aria-expanded=false`, the listbox `hidden`, the visible line "No Skill or file matches “zzq”" ([102-3](img/102-3.png)) | Pass |
| `Esc` with text: the text was cleared, the focus stayed in the field. A second `Esc`: the focus went to `.cm-content` (`closest('.cm-editor')`), the Library stayed open when it was already open | Pass |
| Library unfolded by `Ctrl+P`, `Esc`, `Esc`: cleared, then folded with the cursor in the text | Pass |
| `Enter` on a Skill row: opened its `SKILL.md` (header `git-pr › SKILL.md`), cursor in the text. `Enter` on a file row (`graders`): header `docs-writer › evals/bugfix/graders/before.md`, cursor in the text | Pass |
| Unfolded by `Ctrl+P`, `Enter` on a result: the Library folded (`hidden`), cursor in the text | Pass |
| Already open (`Ctrl+B` first), `Ctrl+P`, `git`, `Enter`: the Library stayed open, cursor in the text. A click on a result row did the same (the row's `mousedown` keeps the focus in the field) | Pass |
| Unsaved text: `Enter` on a result opened the Save / Discard / Cancel dialog with the focus on Cancel. `Esc` (Cancel): the same file, the text still dirty (`•` in the header), the focus back on the field with `retro` still in it and the row highlighted. A `Discard` then opened the file, folded the Library and put the cursor in the text. After a Cancel, `Esc` `Esc` still folded the Library the search had unfolded | Pass |
| Review fix, "already open stays open": `Ctrl+P` (unfolds, flag set), click on a non-focusable part of the page (the focus left the field with no related target), `Ctrl+B` (focus to the tree), `Enter` on the open file: the Library stayed open, cursor in the text. A blur with no target now clears the flag unless the window lost focus (`document.hasFocus()`) | Pass |
| End of the flow, unfolded by `Ctrl+P`, `pr`, `↓` `↓`, `Enter`: Library folded, header `print-setup › SKILL.md`, cursor in the text ([102-7](img/102-7.png)) | Pass |
| Highlighted row after the CSS sharing: outline `rgb(166, 161, 89) 1px` (accent), background `rgb(30, 14, 63)` (raised), text `rgb(255, 221, 0)` = `--color-ink` (the "ink" of DESIGN.md); `<mark>` underline, weight 600, now from the rule shared with the bubble's list | Pass |
| Tab order from the field: `New`, `Refresh`, `Add`, then a tree item (`role=treeitem`) | Pass |
| `Ctrl+B` with the focus in the field folded the Library and put the cursor in the text (the three answers keep working) | Pass |
| `Ctrl+P` under a modal: Preferences (`Ctrl+,`, `dialog[open]`) then `Ctrl+P`: the Library stayed folded, no field focus | Pass |
| Overlay, 900px (`clientWidth` 890): the Library is `position: fixed` over the page, the list inside it ([102-4](img/102-4.png)). `Enter` on a result folded it and put the cursor in the text (the overlay rule, and the search's own) | Pass |
| Column, 1440px: the Library is its own column, the list moves the buttons and the tree down ([102-2](img/102-2.png)) | Pass |
| Rail Search button, click, Library folded: it opened with the focus in the field; open: the focus moved to the field | Pass |
| Combobox attributes read from the field: `role=combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls=library-search-list` (the `listbox`), `aria-activedescendant` the highlighted option's id, `aria-label` "Search the Library" | Pass |
| `Ctrl+P` is not Chromium's print: `defaultPrevented` is set in the capture phase; the menu has no Print role and no `CmdOrCtrl+P` item (`menu-template.test.ts`) | Pass |
| Web build (`pnpm dev`, port 5316, a headless `agent-browser` session): no `aside`, no rail, no combobox; `Ctrl+P` in the text reached the page and `defaultPrevented` stayed `false` ([102-6](img/102-6.png)) | Pass |

**Menu:** no entry for search. ADR 0020 asks for a menu item only for View → Library, and a menu accelerator on `Ctrl+P` would add the double-fire risk the Library key needed a guard for. With no item, only the renderer handles `Ctrl+P`/`Cmd+P`, on every platform, in the capture phase, so CodeMirror never sees it.

**Choices.** The list sits in the Library's flow under the field, not over the buttons and tree, so nothing is half-covered. `Ctrl+P` selects the text in the field, so typing starts a new search. Text left in the field after a result opens stays until it is changed or cleared. The fold-back flag lives in the App: set when `Ctrl+P` or the rail's Search unfolded the Library, cleared when the Library folds or the focus leaves the field for something other than a dialog (a dialog is the Save / Discard / Cancel question) and not while a result is opening. A second `Esc` also folds a Library the search unfolded, which the issue does not say.

Not checked: macOS (`Cmd+P`, the menu without an item), a screen reader, the Library with many roots, a description with a match far beyond the two clamped lines, real X key events (`agent-browser press` sends CDP key events).

Covered by tests: `library-search.test.ts` (tiers, case, ties and Library order across roots, the 12 cap keeping the best, ranges for name, path and description, word definition with punctuation separators, ranges kept right when lower-casing changes a length (`İ`), `SKILL.md` and non-Markdown files skipped, a Skill listed once, trimming), `search-keys.test.ts` (wrap both ways, Enter, the two Esc, modifiers), `library-fold.test.ts` (`isSearchShortcut` by platform, Alt and Shift), `menu-template.test.ts` (no `CmdOrCtrl+P`, no print role).

No model calls, so no row in `ai-costs.md`.
