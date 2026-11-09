# 0020. The Evals page and a foldable Library

- Status: Accepted (2026-11-08); Electron build only ([0016](0016-web-and-electron-builds.md))
- Source: maintainer request after the Eval slices (#92–#95). Evals made the Library hard to use, and the Library already lacked search, folding and keyboard use. The maintainer chose a page over a drawer for Evals.
- Amends: [0018](0018-skill-evals-through-claude-cli.md) (where the Eval panel lives)

## Context

Desafinado is an editor ([PRODUCT.md](../../PRODUCT.md): "The text is the stage"). Evals check a Skill the way tests check code: the writer runs them now and then, not while typing every sentence.

The Eval slices put the Eval panel inside the Library, under the files of the open Skill (`Library.tsx` renders `EvalPanel` in `SkillItem`). A session on a real Skill (`pr-format`) showed:

- The Library is 288px wide (`w-72`). The panel's four-column table, signals and buttons are squeezed into it.
- Files are listed as flat relative paths. A Skill with two Evals lists 13 rows like `evals/bugfix-evidence/graders/befor…`, cut off.
- A Skill row takes three lines: the name and two of description. 28 Skills do not fit on one screen, and there is no search.
- The Library is always open and takes 288px from the page, even while the writer only edits text.
- Every Skill and every file is its own Tab stop. Reaching the last Skill takes dozens of Tabs. There are no arrow keys, no tree roles, and no shortcut to reach the Library or leave it.

The Library holds three jobs: finding files, showing results and running Evals. Evals have no place of their own.

## Decision

**The rule.** Nothing about Evals shows until the writer asks for it, and nothing shows for a Document that is not in a Library Skill.

### Evals page

- **A page in the main column, like Full history.** Title: "How this Skill performs". It shows the Skill that holds the open file, with what 0018 put in the panel: the last complete run, "Did the Skill fire?", "Did it help?", the table, Suspicious cases, cost, the reports, Run Evals and Cancel. The table gets the column's width.
- **One page at a time (State).** The main column shows the text, a Version, Full history or the Evals page. Opening one closes the one before. `Esc` returns to the text, as it does from Full history. A pure `src/ui/page-mode.ts` holds the transitions and wraps the History modes of `src/history/view-mode.ts`, tested first.
- **Opened from the Timeline row.** Evals sits beside Full history, only when the open file is in a Library Skill. It is the only Eval control outside the page. (Amended: it first sat in the header with Open, Save and Review, but it is a page of the main column, not a file action.)
- **A run outlives the page.** The run state (`use-eval-panel.ts`) moves up to the App, for the Skill of the open file, so closing the page or editing the text does not stop the polling. While a run goes, the Evals icon breathes ([DESIGN.md](../../DESIGN.md), Evals page). When a run ends with the page closed, a toast says how it ended, with Show.
- **Another Skill's run.** One run at a time stays (0018). `evals:status` also returns the name of the Skill whose run is going, so the page of another Skill names it instead of a bare "busy".
- **The run dialog stays a dialog.** It is the trust question 0018 asks before each run. The page opens it.
- **The Library knows nothing about Evals.** `Library` loses its `evals` and `unsaved` props.
- **The empty state** of a Skill with no Evals is [#97](https://github.com/walteraandrade/desafinado/issues/97), on this page.

### Library

- **Folded at every start.** The Library opens as a narrow rail at the left edge: a Library button and a Search button, each with its shortcut in its label. With the Library folded, the header still names the open file as `skill › file`. The Web build has no Library and no rail.
- **`Ctrl+B` / `Cmd+B`, one key with three answers:**
  - folded: open it and focus the tree;
  - open, focus elsewhere: focus the tree;
  - open and focused: fold it and put the cursor back in the text.

  The Electron menu gets View → Library with the same key.
- **Open, it takes room only when there is room.** It is its own column when the window fits it beside the 48rem text column. Otherwise it lies over the page's left edge on the raised color with a hairline, with no shadow ([DESIGN.md](../../DESIGN.md), Elevation).
- **A tree (Composite).** Roots, Skills, folders and files are nodes of one tree, built from the listing by a pure `src/skills/library-tree.ts`, tested first. Folders nest: `evals/` is one folder node, folded, labelled with its Eval count. A Skill row shows its name only. The description shows under the open or keyboard-focused Skill, and in search results. (Amended: it first showed on hover too, which moved rows under the pointer and sent clicks to the wrong row.)
- **Keyboard, the WAI-ARIA tree pattern.** `role="tree"`, `treeitem` and `group`, with `aria-expanded`, `aria-level`, and `aria-current` on the open file. The tree is one Tab stop (roving `tabindex`), landing on the open file when there is one. A pure `src/skills/tree-keys.ts` maps a key and the visible items to the next focus, tested first:
  - `↑` `↓` move over the visible items; `Home` `End` go to the first and last.
  - `→` unfolds a node, or moves to its first child; `←` folds it, or moves to its parent.
  - Typing letters moves to the next item whose name starts with them.
  - `Enter` opens a Markdown file and puts the cursor in the text; `Space` opens it and keeps the focus in the tree. On a node, both fold or unfold it.
  - `Delete` on a project root removes it from the Library, as × does. The folder stays on disk.
  - `Esc` puts the cursor back in the text.
- **Tab order** inside the open Library: the search field, then New, Refresh and Add, then the tree.

### Search

- **`Ctrl+P` / `Cmd+P`** opens the Library with the focus in its search field. The field also sits at the top of the open Library.
- **What it searches:** Skill names, descriptions, and the paths of the files in each Skill. Not the text inside files.
- **Suggestions as the writer types**, in the shape of the bubble's Action list ([DESIGN.md](../../DESIGN.md)): rows on the fill color, split by hairlines, the match underlined. The highlighted row takes the raised color, ink text and a 1px **accent** outline. Not the AI color: nothing here is AI-authored (the One Author Color Rule).
- **Order**, by a pure `src/skills/library-search.ts`, tested first: a Skill name that starts with the text, then a word in a name that starts with it, then a file path, then a description. Ties keep the Library's order. At most 12 rows.
- **Keys, the WAI-ARIA combobox pattern** (`role="combobox"`, `aria-activedescendant`, a `listbox`): `↓` `↑` move and wrap. `Enter` opens the row: a file opens itself, a Skill opens its `SKILL.md`. `Esc` clears the text; a second `Esc` puts the cursor back in the text.
- **A search folds back.** If `Ctrl+P` unfolded the Library, opening a result folds it again and puts the cursor in the text. If the Library was already open, it stays open.

## Consequences

- A writer who never runs Evals never sees them, and the Library at rest is a rail.
- To see a Skill's Evals, the writer opens one of its files. There is no view of Evals across Skills.
- Text and results are not side by side. Runs take minutes (0018), so the writer runs, edits, and comes back.
- A writer who lives in the Library presses `Ctrl+B` once per session.
- Two new shortcuts, `Ctrl+B` and `Ctrl+P`. Neither is bound today: not by the app, the Electron menu's roles, or CodeMirror, whose `Ctrl-b` and `Ctrl-p` are Emacs keys on macOS only, where the app uses `Cmd`. In the Web build both do nothing.
- `EvalPanel` becomes the page's content. In 0018, "the panel" now means the Evals page.
- On acceptance, DESIGN.md gets the rail, the tree rows, the search list and the Evals page, and GLOSSARY.md gets the Evals page and the Library's search and folding. The Evals page entries landed with [#99](https://github.com/walteraandrade/desafinado/issues/99); the rest land with #100–#102.

## Alternatives considered

- **A drawer on the right for Evals:** text and results side by side, but one more narrow panel, the same squeeze as today, and one more thing pulling the eye from the text (PRODUCT.md, principle 1).
- **A separate window for Evals:** full separation, but the app has one window today, and two need a design of their own (BACKLOG.md, One window per file).
- **A setting that hides Evals:** the least work, but a writer who uses Evals still gets the squeezed Library.
- **Remember whether the Library was open:** one key less for heavy users, but the maintainer asked for folded by default.
- **Search inside the files' text:** finds a phrase anywhere, but needs the main process to read every file on each search, or an index, and results need snippets. It can come later behind the same field.
