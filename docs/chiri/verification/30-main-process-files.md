# Issue #30 verification: Files through DocumentFiles

Issue [#30](https://github.com/walteraandrade/chiri-ai-editor/issues/30), stacked on [PR #36](https://github.com/walteraandrade/chiri-ai-editor/pull/36) (the Electron shell). Checked on 2026-11-01 on the maintainer's Hyprland (Wayland), with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy:

- **Electron build:** `CHIRI_DEV_PORT=5302 CHIRI_CDP_PORT=9302 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> pnpm dev:electron`, attached with `agent-browser --session chiri-s30 connect 9302`.
- **Web build:** `CHIRI_DEV_PORT=5302 pnpm dev` in `agent-browser`'s own Chrome.
- **Skills:** a temp root made with `mktemp -d`, never a real skill folder: `agents/skills/alpha/SKILL.md` (mode 640, reached through the directory symlink `claude/skills/alpha`) and `agents/skills/gamma/SKILL.md` (mode 750, reached through the file symlink `claude/skills/gamma/SKILL.md`).

```text
before  useMarkdownFile → createFileActions({ host: FileHost, fallback }) → File System Access / <input type=file>
after   kit.files: DocumentFiles<Ref>  { open, read, save } → OpenResult | SaveResult (values)
        Web kit       createWebFiles(host, fallback)      Ref = FileSystemFileHandle, picker lock inside
        Electron kit  createElectronFiles(window.chiri)   Ref = real path
          preload  openFile · readFile · saveFile · saveFileAs · flushStorage
          main     requests.ts (zod) → handlers.ts → readMarkdown · saveMarkdown (decideSave → writeAtomic)
        kit.unsavedText { initial, changed(text, file), offered(ref) }   Electron: per file, UnsavedStore<Ref> port
        kit.start { name, ref, savedText, diskChanged }                  Electron: the last file, reopened before the first render
```

## Dialogs: what was driven for real and what used the stub

`agent-browser` cannot drive a GTK dialog, so the keyboard was tried first (`wtype` is installed). Open and Save as do open the real dialog, a GTK portal window ([30-1](img/30-1.png)), and `Ctrl+L` followed by a typed path reached its location field. The `Return` that should confirm it never did, in several attempts (`Return`, `KP_Enter`, `Return` held for 150 ms, and after a focus fix with `hyprctl`). Other agents' Chiri windows also took the focus while this ran, so some of those keystrokes landed in their windows, not in the dialog.

So **every Open and Save as in the table below picked its file through `CHIRI_DEV_PICK_FILE`** ([`dev-dialogs.ts`](../../../electron/main/files/dev-dialogs.ts)): the main process reads the path from that file instead of showing the dialog. It exists only when `ELECTRON_RENDERER_URL` is set (the dev server), has unit tests, and is listed in `AGENTS.md`. Save in place, reopening at start, the killed process, the conflict and the Review pass never go through a dialog.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD: frontmatter detection and Block extraction skipping it, Targets inside the frontmatter refused, the Save decision, the Web adapter's results as values | Pass | Frontmatter: `src/blocks/frontmatter.test.ts` and the Block, Target and Suggestion tests of the cherry-picked commits. Save decision: `electron/main/files/save-decision.test.ts` (write when the disk equals the last read or written text, conflict otherwise, CRLF and byte order mark not a change). Web adapter: `src/document/web-files.test.ts`. 1182 tests in 85 files |
| Electron: a skill's `SKILL.md` opens from the native dialog, saves in place, and its unsaved text survives a restart and a killed process | Pass, with the stub for the pick | Open: [30-2](img/30-2.png), header `SKILL.md`, the frontmatter on top. Save: `Ctrl+S` showed "Saved SKILL.md" ([30-3](img/30-3.png)) and the file on disk held the edit. Restart: typed text, `SIGTERM` to my own Electron PID, started again: the last file reopened with "Restored unsaved changes to SKILL.md" and the dot ([30-4](img/30-4.png)). Killed process: typed `UNSAVED-BEFORE-KILL.`, waited 2 s, `kill -9` on my own Electron PID, started again: text back, dot on, the file on disk without it |
| Electron: a skill reached through a symlink keeps its symlink and its file mode after Save | Pass | `alpha` through the directory symlink and `gamma` through the file symlink ([30-3](img/30-3.png)): after Save both links were still symbolic links to the same targets, the targets held the new text, the modes stayed 640 and 750, and the folder held only `SKILL.md` (no temporary file) |
| Electron: a file changed on disk after Open is never overwritten by Save; the notice offers "Reload from disk" and "Keep mine" | Pass | A line appended outside the app, then Save: the notice appeared ([30-5](img/30-5.png)) and the file's SHA-256 did not change. "Keep mine": notice gone, dot still on; Save again: notice again, file unchanged. "Reload from disk": the Document took the disk text, clean ([30-6](img/30-6.png)); the next Save wrote. The same notice shows at start when the file changed while the app was closed with unsaved text ([30-7](img/30-7.png)) |
| Both: a Review pass on a `SKILL.md` leaves the frontmatter alone | Pass | Electron: no Suggestion on the frontmatter ([30-8](img/30-8.png)); Accept all then Save, and the first 5 lines on disk are the original frontmatter, the body corrected. Web: the same text pasted into the editor ([30-9](img/30-9.png)); after Accept all the frontmatter lines are unchanged |
| Web: Open, Save and Save as behave as ADR 0011 says | Partly | The pickers cannot be driven in `agent-browser`'s Chrome. Open from the page ended with no toast and no change (a cancelled picker), and the Document survived a reload (autosave unchanged). Picker, handle write, Save as, cancel, failed write, download and file-input fallbacks and the lock are the unit tests of `web-files.test.ts` and `file-access.test.ts`, which kept their cases |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; records and screenshots here, `ai-costs.md` updated | Pass | 1182 tests in 85 files; Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/`. No `sk-or-` string in `dist/` or `out/` |

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| Save as | Pass | `Ctrl+Shift+S` with a name without extension: the file was created as `copy-of-alpha.md` (mode 644) and the header followed it |
| A failed Save keeps the text | Pass | The folder made read-only: "Could not save SKILL.md: Permission denied", dot still on, file and folder untouched. Mode restored afterwards |
| Last file reopens at start | Pass | Every restart above reopened the last file with no Open |
| A failed start shows something | Pass by tests | `mountApp` renders `StartError` when the kit factory rejects (`start-error.test.ts` for the message). Not forced in the window |

## For the maintainer's manual test

These need a real desktop window and a human on the GTK dialog, which the automated checks could not do (the run happened in a visible window, before the headless gamescope rule; the dialog never accepted the typed path):

1. `pnpm dev:electron`, press Open, pick a `SKILL.md` in the dialog: it opens, the header shows its name.
2. Edit it, press Save, then press Save as and pick a name with no `.md`: the file is created with `.md`.
3. Open a skill reached through a symlink, edit and Save: the link is still a link.
4. Press Open, cancel the dialog: nothing changes and no toast shows.

Not checked: a Review pass launched from a reopened draft; Windows and macOS (Linux first, [0013](../adr/0013-native-app-on-electron.md)); hard-linked files (the rename gives the path a new inode, so a hard link does not follow).

## AI calls during verification

`window.__aiCalls` was **not read**: the permission system refused `agent-browser eval`, so this step is skipped, as the brief says. Each call's generation id came from `agent-browser network requests`, and its record from `GET /api/openrouter/generation?id=…` through the dev proxy (the call the client makes itself). That gives tokens, cost, provider and OpenRouter latencies, but not the client total, the time to the first Suggestion, or whether a retry happened. Latencies are OpenRouter `latency` / `generation_time`, in ms.

| Build | Task | Model → served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency | Finish | Generation id |
|---|---|---|---|---|---|---|---|
| Electron | review document → default criteria, on `alpha/SKILL.md` | `openai/gpt-6.1-terra` → OpenAI | 699 / 323 / 41 / 0 | 0.001992 | not read / 1720 / 3869 | stop | `gen-1793542768-l7Hhd5nACuluhp9qwZYR` |
| Web | review document → default criteria, same text | `openai/gpt-6.1-terra` → OpenAI | 632 / 209 / 0 / 0 | 0.001620 | not read / 1044 / 3034 | stop | `gen-1793542929-TByjJ6HJjsds79J20vik` |

Total US$0.003612. The key was never printed.

## Decisions worth a look in review

- **`expected` travels with Save.** The renderer sends the session's `savedText` (the text last read or written), and the main process compares `decodeMarkdown(disk)` with it. The main process keeps no per-file state, so it survives a reload of the window, and the comparison is in `decideSave`, a pure function. A file that vanished or stopped being UTF-8 text counts as a change.
- **Unsaved text keeps `base`.** The per-file store holds `{ text, base }`, `base` being the text the edits started from. On reopen the session's `savedText` is `base`, not the disk text, so a file an agent changed while the app was closed still ends in the External change notice instead of being overwritten by the draft. The History slice's `drafts` table needs that column too (a hash into `blobs` would do).
- **`flushStorage`.** Chromium writes `localStorage` to disk a few seconds late, so a `kill -9` right after typing could lose the draft. After each draft write the renderer asks the main process for `session.flushStorageData()`. The History slice replaces this with SQLite.
- **Rename order in Open.** The action now moves the session to the new file, then replaces the text, then tells the History. Before, the text came first, and an edit event during the replace would have been filed under the old file's draft.
- **The lock moved into the Web adapter**, as the issue says, and a second Electron-side lock covers every Electron call. A call that comes while another waits answers `cancelled`.
- **"Keep mine" never forces a Save**, as [0014](../adr/0014-skills-on-disk.md) says: the next Save asks again. The ways out are "Reload from disk" or Save as.
- **Paths are validated and limited.** Every request is parsed with zod in the main process (absolute path, no NUL, size limits, strict fields); only `.md` and `.markdown` files are read or written, checked on the resolved path; text must be valid UTF-8; files over 5 MiB are refused.
- **Frontmatter is shown as a heading.** The editor's Markdown highlighting still styles a YAML frontmatter as a level-2 heading (see [30-2](img/30-2.png)). Only Blocks and Targets skip it. Slice 6's frontmatter panel is the place to style it.
