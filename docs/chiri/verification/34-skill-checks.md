# Issue #34 verification: Skill checks, frontmatter panel and New skill

Issue [#34](https://github.com/walteraandrade/chiri-ai-editor/issues/34), stacked on [PR #40](https://github.com/walteraandrade/chiri-ai-editor/pull/40) (#33, External changes, `55bf70b`). Checked on 2026-11-02, in the Electron build inside a headless `gamescope` (no window on the desktop), and in the Web build in `agent-browser`'s own Chrome:

- **Electron run:** `CHIRI_DEV_PORT=5306 CHIRI_CDP_PORT=9306 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> gamescope --backend headless -W 1440 -H 900 -- env -u WAYLAND_DISPLAY ELECTRON_OZONE_PLATFORM_HINT=x11 HOME=<temp home> electron-vite dev`, attached with `agent-browser --session chiri-s34 connect 9306`. Everything up to [34-8](img/34-8.png) ran on the branch before the rebase; [34-9](img/34-9.png) and the short re-check of New skill ran on the rebased branch (with #33's watcher).
- **Web run:** `CHIRI_DEV_PORT=5306 pnpm dev`, `agent-browser` on `http://localhost:5306`.
- **No real skill was touched.** `HOME` pointed at a temp folder, so the two default roots were `<temp>/home/.claude/skills` and `<temp>/home/.agents/skills`, and New skill could only create there. The fixture: `alpha` (valid), `beta` (folder `beta-skill`, name `beta`), `broken-yaml` (an unclosed `[`), `no-close` (frontmatter never closed), `missing-desc` (no `description`), and an empty `plain-folder` that is not a skill. A project root was added with the dialog stub ([`CHIRI_DEV_PICK_FILE`](../adr/0013-native-app-on-electron.md)): the Library's Add used it, nothing else in this slice goes through a native dialog.
- **`agent-browser eval` was refused** by the permission system, so nothing here read the page's state in-page: text came from `snapshot` and `get text`, files from `cat` and `ls` on the temp folder. Claude Code itself was not run.
- **No model calls** in this slice, so no AI call records ([ai-costs.md](../ai-costs.md) says so).

```text
shared code (both builds)
  inspectFrontmatter(text, { fileName, folderName })        src/skills/frontmatter-panel.ts
    readFrontmatter  → absent | present(fields) | invalid(problem)       (#34 groundwork)
    checkSkillFrontmatter(fields, folderName?)                           (#34 groundwork)
    → none | unreadable(problems) | skill{ name, description, present, problems }
       skill rules only for a file named SKILL.md; a broken frontmatter is reported for any file
  useFrontmatterReport → FrontmatterPanel (name, description) + count on the Save button
  panel edit → DocumentControls.setSkillFields → planFieldEdit
       planSkillFieldEdits(text, values) → the edits setSkillFields would apply, in the ranges it knows
         (creation = one insertion at 0; an edit = only the replaced value) → one CodeMirror transaction (input.type)
  editor: frontmatterMarks(text) → line and key decorations (frontmatter-style.ts)
Electron only
  Library "New" → NewSkillDialog (newSkillDraft: same name rules, "already exists") → kit.library.createSkill
  preload createSkill → main: parseCreateSkillRequest → root must be a Library root → checkSkillName
       → mkdir <root>/<name> (EEXIST = refused) → writeAtomic SKILL.md ← skillTemplate(name)
       → on a failed write remove the folder → { created, realpath } → refresh Library → open file
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers frontmatter parsing, each rule, and the New skill template | Pass | Parsing (below #34's groundwork): `frontmatter-fields.test.ts`. What this slice adds: `frontmatter-panel.test.ts` (the report for a SKILL.md, another file, no file, a missing frontmatter, every rule's display text, a YAML error with its line, a `---` block that is not YAML), `skill-frontmatter.test.ts` (`checkSkillName` agrees with the frontmatter check on the name), `frontmatter-fields.test.ts` (`planSkillFieldEdits` describes the same text as `setSkillFields` on eleven documents and six sets of values, one insertion to create, only the value range to edit, no overlap), `frontmatter-edit.test.ts` (YAML kept valid for values that need quotes, a multi-line value and an empty one, the body byte-identical, a body that starts with a dash, refusals), `frontmatter-commands.test.ts` (one transaction, the cursor kept, undo, a typing burst as one undo step, the History sees an ordinary edit, a Suggestion on a body that starts with a dash keeps its text, the cursor at the start goes with the body), `skill-frontmatter.test.ts` also has the `compatibility` rule (absent, 1 to 500 characters counted as characters, empty, not text, the order), `file-actions.test.ts` (`openCreated`: asks first, creates nothing on Cancel, saves first on Save, asks once on Discard, nothing created, a new file that cannot be read), `frontmatter-panel.test.ts` also has the announcement (the same text while only numbers, lines or the folder change; a new text when a kind of problem appears or goes), `frontmatter-marks.test.ts`, `skill-template.test.ts` (reads back, passes every check, names YAML would read as another type, the sections the specification recommends), `new-skill.test.ts` (the dialog's draft), `create-skill-request.test.ts` and `create-skill.test.ts` (the request, on real temp folders: refused names, `..`, a root that is not in the Library, existing folder, file or broken link, two requests racing, a failed write cleaned up). 2395 tests in 133 files |
| A broken frontmatter shows what is wrong before Save, in both builds | Pass | Electron: `broken-yaml` shows "YAML error on line 4: Flow sequence in block collection must be sufficiently indented and end with a ]" ([34-3](img/34-3.png)); `no-close` shows "The frontmatter is not closed. Add a --- line after the last key" ([34-4](img/34-4.png)); `missing-desc` shows "description is missing. Agents read it to decide when to use the skill" under the field ([34-5](img/34-5.png)). Each has the count on the Save button. Web: a frontmatter typed at the top of the untitled Document, not closed, shows the same message and the count ([34-10](img/34-10.png)); closing it clears both and styles the block ([34-11](img/34-11.png)). In the Electron build, closing the frontmatter in the editor brings the fields back at once ([34-6](img/34-6.png)) |
| Editing `name` or `description` in the panel changes only the frontmatter, and the YAML stays valid | Pass | `alpha`: typing `-Two` in `name` changed that one line of the editor text, with `license: MIT` and the body untouched ([34-2](img/34-2.png)). A description of `Use when: asked # not a comment` came out as `description: "Use when: asked # not a comment"` and nothing else moved. Save wrote the file with the edited name even with 2 problems showing (problems never block Save), and a `fill` back to `alpha` restored it. Undo and Redo pressed inside the field went to the Document's history: `Ctrl+Z` took the typing burst back in one step, `Ctrl+Shift+Z` redid it |
| A new skill appears in the Library, and Claude Code lists it | Pass for the Library and the layout; Claude Code is on the maintainer's list | New skill in `~/.claude/skills` (temp home) with `release-notes-writer`: the Library went 5 → 6 skills, the toast said "Opened SKILL.md", the new file opened with the fields filled and no problems ([34-8](img/34-8.png)). On disk: `release-notes-writer/SKILL.md` only (no temporary file), folder 0755, file 0644, starting `---\nname: release-notes-writer\ndescription: Describe what this skill does and when an agent should use it.\n---`. Ruby's Psych (a YAML parser that is not the app's) read exactly `name` and `description`, `name` equal to the folder, lowercase letters and hyphens, 1 to 64 characters, and a description of 1 to 1024. Same in a project root added through the dialog stub (`local-skill`). The same on the rebased branch, with #33's watcher: `second-check` appeared and opened, with no "changed on disk" notice and no External Version a few seconds later ([34-9](img/34-9.png)) |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; screenshots in `docs/chiri/verification/` | Pass | 2395 tests in 133 files; Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/`. No `sk-or-` string in `dist/` or `out/` |

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| The name is checked against the folder the Library lists | Pass | `beta` (folder `beta-skill`, name `beta`): "name must match its folder name, "beta-skill". Rename the folder or change the name". Typing `-Two` into `alpha`'s name showed both "name must be lowercase" and the folder mismatch ([34-2](img/34-2.png)) |
| New skill, name rules | Pass | `Bad Name--` lists four problems, shows `~/.claude/skills/Bad Name--/SKILL.md` under the field, and Create is dimmed and disabled ([34-7](img/34-7.png)). `alpha` is refused in the dialog ("A skill folder named "alpha" already exists in ~/.claude/skills") before any call |
| New skill, a folder the Library does not list | Pass | `plain-folder` (an empty folder, no `SKILL.md`, so not in the Library) was refused by the main process with "A folder named "plain-folder" already exists there", shown in the dialog; the folder stayed empty |
| New skill with unsaved text open | Pass | The question comes before anything is created (first version: after, which was changed). With `compat-bad` dirty (a `x` typed into its name), Create showed "Save changes to SKILL.md?" and `~/.claude/skills` still had no `leave-first` ([34-13](img/34-13.png)); Cancel left the folder absent and the dialog open with the name; Create again and Discard made the folder and opened it, and the file that was open stayed as it was on disk. On the final build: Create, Save wrote `dash/SKILL.md` with its frontmatter, then `after-rebase` was created and opened with no problems |
| `compatibility`, when present | Pass | `compat-bad` has `compatibility` as a YAML list: "compatibility must be text" shows under the fields and the count 1 is on Save; Save still writes ([34-12](img/34-12.png)). Absent, or 1 to 500 characters, is no problem (unit tests, counted as characters). The panel does not edit it |
| A body that starts with a dash | Pass | `dash/SKILL.md` is `- item`, `- other`, no frontmatter. Typing `dash` into the panel's name gave `---`, `name: dash`, `---`, a blank line and the two items, all intact ([34-14](img/34-14.png)). The first version found the frontmatter by a text diff and reused the body's first `-`; see "What the checks found" |
| Screen readers | Pass for the markup | The panel has one live region (`aria-live="polite"`, `aria-atomic`) whose text names the kinds of problem ("Frontmatter problems: description is missing") and is the same string while only counts, lines or the folder change; no element in the panel has `role="alert"`. Not tried with a screen reader |
| The panel stays out of the way | Pass | The header does not move when problems appear or go (the count sits on the Save button, [34-3](img/34-3.png) against [34-6](img/34-6.png)), and a frontmatter in a file that is not `SKILL.md` gets no panel and no skill rules (the Web check above: `name: demo` in the untitled Document, no problems). The report is compared before it replaces the old one (`isSameReport`, a unit test), so typing in the body does not redraw the panel; that was not measured in the browser |
| Library header at 1440 px | Fixed | The New button made the title wrap to "Library · 5 / skills"; the buttons now go on a second row when they do not fit ([34-1](img/34-1.png) onward) |

## What the checks found

- The first version of the Save marker was a "⚠ 2 problems" button between Open and Save. It pushed the header onto a second row, which moves the whole page when a problem appears or goes. It is now a small count on the corner of Save.
- The disabled Create button looked enabled: the accent style is `!important`, as in the leave dialog, and hid the disabled style. It has its own disabled style now.
- Native undo in the panel's fields and the editor's history were two histories: `Ctrl+Z` in a field undid the browser's own stack, then the editor undid something else. Undo and Redo in the fields now go to the Document.
- A panel edit used its own user event, so each keystroke was an undo step. It now uses the editor's typing event: a burst in one field is one step, and an edit of the other field is its own.

## Review

First pass (`opus`, 5422d03..291f154): Standards clean. Two findings, both fixed:

- **A frontmatter created above a body that starts with a dash.** The panel turned the new text into a change with a common prefix and suffix, so for `- item` it inserted inside the body, reusing its `-` as the first character of `---`. A Suggestion on that Block then covered the new YAML, and the cursor stayed above the frontmatter. The change is now what `setSkillFields` knows (`planSkillFieldEdits`: creation is one insertion at 0, an edit is only the value's range), `changeBetween` is gone, and the cursor moves with the text that follows. Tests: the plan describes the same text as `setSkillFields` on eleven documents (the old suite still passes), a Suggestion on the first Block keeps its text and sits after the frontmatter, the cursor at 0 goes with the body.
- **A live region that spoke on every keystroke.** The problem lists had `role="alert"`, and their text carries counts and lines, so a screen reader read each character typed. The visible lists are plain lists now; one polite live region says which kinds of problem there are, and its text does not change while only the numbers do (same for the New skill dialog). Tests: `announceProblems` and the draft's `announcement`.

Also from the coordinator's answers: a `compatibility` rule (text, 1 to 500 characters, only when present), and New skill asks Save / Discard / Cancel before it creates anything.

## For the maintainer's manual test

These need your real Claude Code and your real skill folders, which I must not touch:

1. **Claude Code lists a skill made by the app.** `pnpm dev:electron`, Library → New, folder `~/.claude/skills` (or a project root such as `<repo>/.claude/skills`), name `chiri-smoke-test`, Create. Edit the `description` in the panel to something specific, for example "Replies with the word pong. Use when the user asks for a ping test.", and Save. Start a new Claude Code session in a terminal (skills are read at startup; for a project root, start it in that repo) and run `/skills` (or ask "which skills do you have?"): `chiri-smoke-test` must be listed with that description. Then ask for a ping test and check the skill loads. Delete the folder afterwards (`rm -r ~/.claude/skills/chiri-smoke-test`).
2. **A problem Claude Code would also trip on.** In that skill, change `name` to `Chiri Smoke` in the panel: the count 2 appears on Save. Save anyway (it must write) and check that Claude Code in a new session no longer lists it under that name, or lists it by its folder; then set the name back.
3. **A real skill with a mismatch.** Open one of your own skills whose `name` differs from its folder (the check will tell you if there is one); the message should name the folder. Do not Save unless you want the change.
4. **The Web build with a real file.** `pnpm dev`, Open a `SKILL.md` (a copy, not the real one) with Chrome's picker: the panel should show `name` and `description`, with no folder rule (the Web build does not know the folder).

## Not checked

- **The panel for a `SKILL.md` in the Web build, in a real browser.** It needs Chrome's file picker (the Web build uses `showOpenFilePicker`), which `agent-browser` cannot drive, and `eval`, which I would have used to fake it, was refused. I tried launching Chrome without the File System Access API to reach the file-input fallback; the flags had no effect. The panel is the same component and the same pure code as in Electron (the folder rule is the only difference, and it is a unit test); the Web build was checked for the broken-frontmatter message and the Save count. Item 4 above covers it.
- Claude Code itself (item 1 above).
- A native GTK dialog for the folder choice: New skill picks the folder from a list of the Library's roots, so it has no dialog. Add used the stub, as in #32 and #33.
