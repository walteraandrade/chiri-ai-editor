# Issue #32 verification: Library

Issue [#32](https://github.com/walteraandrade/chiri-ai-editor/issues/32), stacked on [PR #38](https://github.com/walteraandrade/chiri-ai-editor/pull/38) (History store). Checked on 2026-11-01. No model call was made, so there are no AI call records and `ai-costs.md` only gets a note.

- **Electron build:** `CHIRI_DEV_PORT=5304 CHIRI_CDP_PORT=9304 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> pnpm dev:electron` inside `gamescope --backend headless` (no window on the desktop), attached with `agent-browser --session chiri-s32 connect 9304`.
- **Web build:** `CHIRI_DEV_PORT=5304 pnpm dev` in `agent-browser`'s own Chrome.
- **Skills:** the real default roots were only read (listed, never opened or written). Everything that was opened, edited or saved lives in temp roots made with `mktemp`-style folders: `proj/.claude/skills` (`demo-skill` with `SKILL.md`, `extra.md`, `references/forms.md`, `run.sh`; `other-skill`; `broken-skill` with a YAML error) and `linkroot/skills` (`solo`, and `demo-link`, a symlink to `proj/.claude/skills/demo-skill`).

```text
kit.library?: LibraryKit<Ref>    list · addRoot · removeRoot · toRef        Electron only; absent in the Web kit
  preload   listLibrary · addLibraryRoot · removeLibraryRoot (one function per action, no generic invoke)
  main      electron/main/library/  handlers → scanSkillRoots(nodeSkillFileSystem, [defaults, ...projectRoots])
            roots-store: <userData>/library-roots.json, atomic write; unreadable file → error, never "no roots"
sidebar     Library.tsx → click a .md → file.openRef(ref) → files.read → [Save / Discard / Cancel] → arrive
                                                    → onOpened → history.select(ref)   (the same path as Open)
```

## Dialogs: what was driven for real and what used the stub

**Every Add of a project root and every Save as in the table picked its folder or path through `CHIRI_DEV_PICK_FILE`** ([`dev-dialogs.ts`](../../../electron/main/files/dev-dialogs.ts)), which now also answers the folder dialog. The GTK dialogs were not driven. Opening a file from the Library, the Open button and Save never go through a dialog except the app's own Save / Discard / Cancel one, which `agent-browser` clicked normally.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers scanning roots into Skills: frontmatter `name` and `description`, the folder's files, symlinks once by real path, folders without a `SKILL.md` skipped | Pass | `src/skills/scan-skills.test.ts` and `frontmatter-fields.test.ts` (the groundwork), plus `electron/main/library/node-skill-fs.test.ts`, which runs the scanner on a real temp tree with a symlinked skill under two roots. 1975 tests in 110 files |
| Every skill in both default roots is listed once | Pass | The Library counted 43 skills, 30 under `~/.claude/skills` and 13 under `~/.agents/skills` ([32-1](img/32-1.png)). An independent count from a script (unique real paths of the folders with a `SKILL.md`, first root wins) gave the same 43, 30 and 13. The skill with a YAML error (`cross-impl-bugs`) is listed, with its problem in red |
| A project root can be added, and it is kept across restarts | Pass, with the stub for the folder | Two roots added: 43 → 46 → 47 skills ([32-2](img/32-2.png)); `library-roots.json` held both. Stopped the app, started it again on the same user data: both roots still listed and the last file reopened. Adding a default root again: "~/.claude/skills is already in the Library" ([32-6](img/32-6.png)). The × on a project root removed it (47 → 46) and the file followed |
| A skill reached through a symlink and through its target shows once | Pass | `demo-link` (in `linkroot`) points at `demo-skill` (in `proj`): `linkroot` listed only `solo`, `demo-skill` appeared once, under the first root that reaches it ([32-2](img/32-2.png)) |
| Clicking a `.md` file opens it; other files are listed, not opened | Pass | `SKILL.md`, `extra.md` and `references/forms.md` opened, and the header shows the skill and the path inside it: `demo-skill / SKILL.md`, `demo-skill / references/forms.md` ([32-10](img/32-10.png)). `run.sh` is listed in a muted colour and is not a button |
| Switching files never loses text: Save / Discard / Cancel when the Document is dirty | Pass | `extra.md` edited, then `SKILL.md` clicked: "Save changes to extra.md?" ([32-5](img/32-5.png)). Cancel: still on `extra.md`, dot on. Discard: opened `SKILL.md`; back on `extra.md` the unsaved line was gone and the file on disk unchanged. Save: the file on disk held the edit, then `SKILL.md` opened. The same question appears for Open (button or `Ctrl+O`) after the file is picked |
| Each file shows its own Timeline | Pass | `SKILL.md` after one Save: two dots (Started with 16 words, You added 5 words) ([32-4](img/32-4.png)); `extra.md`: its own dots, none of those ([32-3](img/32-3.png)); back on `SKILL.md`: the same two dots. Opening goes through `onOpened → history.select(ref)`, as Open does |
| The Web build has no Library and is otherwise unchanged | Pass | No `<aside>`, the same header (Open, Save, Review), the sample Document and the one Started dot ([32-11](img/32-11.png)). With edits made, Open shows no Save / Discard / Cancel question (the Web kit has no `discard`, so the guard is off) |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; screenshots here | Pass | 1975 tests in 110 files; Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/` |

## Review fixes (first pass)

| Fix | Check | Result |
|---|---|---|
| Picking the open file and answering Save no longer reverts the editor | `extra.md` edited, `Open` with the stub pointing at the same file, answered Save | The editor kept the edit, the dot went off, the disk held the text, and no External change notice showed. The file is read again after the Save when the Save wrote the file being opened (`file-actions.test.ts`, "picking the file that is open") |
| An untitled Document with edits is asked about too | Sample Document edited, a Library file clicked: "Save changes to Untitled?" ([32-9](img/32-9.png)) | Cancel stayed. Save went to Save as (the stub's path), the new file held the text, then the clicked file opened with its own Timeline. A Document with no file and no edits switched with no question |
| An unreadable `library-roots.json` is an error | The file replaced with `{ "projectRoots": "oops`, app started | "Could not read library-roots.json. Project folders are not listed…" above the default roots ([32-7](img/32-7.png)). Add: "Could not add the folder: Could not read library-roots.json" ([32-8](img/32-8.png)); the file was byte for byte what I wrote. Restored the file and pressed Refresh: the project roots came back |
| `setSkillFields` refuses a second frontmatter | `frontmatter-fields.test.ts`: a flow mapping, comments only, and a rule + prose + another rule give `frontmatter-not-recognized` | Unit only. A Document that starts with a lone rule and no closing `---` still gets a frontmatter above it, as before |

## For the maintainer's manual test

These need a real desktop window and a human on the GTK dialogs, which the automated checks could not drive:

1. `pnpm dev:electron`, press **Add** in the Library and pick a project's `.claude/skills` folder in the real dialog. It appears, and it is still there after a restart.
2. Click a `SKILL.md` from `~/.claude/skills` (a real one), edit it, click another skill's file: the question appears; try Cancel, Discard and Save. Nothing in this record opened or wrote a real skill.
3. `Esc` on the question cancels it (the dialog is a native `<dialog>`; `Esc` was not pressed in the checks).
4. At a window narrower than about 1440 px the margin Cards of the Active Suggestion float above the text, because the Library takes 18 rem. A follow-up can left-align the column or add a toggle for the sidebar.

Not checked: Windows and macOS (Linux first, [0013](../adr/0013-native-app-on-electron.md)); a `plugin` skill folder (not listed by design, [0014](../adr/0014-skills-on-disk.md)); more than three levels of folders inside a skill (the scanner stops at depth 3).

## AI calls during verification

None. No check pressed Review, Shorter or any other model action.
