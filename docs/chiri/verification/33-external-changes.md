# Issue #33 verification: External changes

Issue [#33](https://github.com/walteraandrade/chiri-ai-editor/issues/33), stacked on [PR #39](https://github.com/walteraandrade/chiri-ai-editor/pull/39) (#32, the Library). Checked on 2026-11-01 in the Electron build, inside a headless `gamescope` (no window on the desktop):

- **Run:** `CHIRI_DEV_PORT=5305 CHIRI_CDP_PORT=9305 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> gamescope --backend headless -W 1440 -H 900 -- env -u WAYLAND_DISPLAY ELECTRON_OZONE_PLATFORM_HINT=x11 HOME=<temp home> electron-vite dev`, attached with `agent-browser --session chiri-s33 connect 9305`.
- **No real skill was touched.** `HOME` pointed at a temp folder, so the two default roots were `<temp>/home/.claude/skills` and `<temp>/home/.agents/skills`. The fixture: `alpha` (real folder under `.agents/skills`, reached through a directory link in `.claude/skills`, with a `references/guide.md`), `beta`, `gamma` (a link to `<temp>/outside/gamma`, outside every root) and `delta` (a link to a skill folder inside a clone). A project root was added with the dialog stub ([`CHIRI_DEV_PICK_FILE`](../adr/0013-native-app-on-electron.md)); so was the open of a loose `note.md`.
- **An agent's edit was simulated from a shell**, never by running Claude Code: in place (truncate and write the same inode) and as write-temp-then-rename (a dot-named temp file in the same folder, then `mv` over the target), which is how editors and the app's own Save write.
- **The pull was real:** a temp bare repository and two clones; one clone holds `skills/delta`, linked into the root; the other pushes an edit; `git pull` in the first rewrites the open file.
- **No model calls** in this slice, so no AI call records ([ai-costs.md](../ai-costs.md) says so).

```text
fs.watch (one per folder, not recursive)            main process
  → FolderWatcher            opens / closes watches by folder identity (dev:ino)
  → Batcher                  250 ms after the last event, at most 1 s
  → classifyEvents           { paths, library }: hidden names out, rename / SKILL.md → library
  → push 'external:changes'  one subscribe function in the preload (onExternalChanges)
  ← watchFile(path | null)   which file is open (validated: absolute, .md / .markdown)
  ← roots saved              ExternalChangesController scans again, from listLibrary

renderer
  kit.external { watch, subscribe, readDisk }     Electron: createElectronExternal(api)
  kit.library.subscribe                           → useLibrary refreshes; same listing → no redraw
  useMarkdownFile → createExternalCheck.run(ref)
      readDisk → decideExternalChange({ disk, savedText, document, writing, noticed })
         nothing   own write in flight, or the disk text the user already answered
         settled   disk holds the saved text (own write done, or a touch): clears a stale notice
         reload    clean Document (or one that already equals the disk) → reloadFrom(file)
                   → editor.refresh (smallest change, cursor and scroll kept) → onReloaded → history.external
         notice    dirty Document, or the file is gone / not UTF-8 → External change notice
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers the decision for a change (own write, clean reload, dirty notice) and the External Cause | Pass | The decision: `src/document/external-change.test.ts` (12 cases: own write in flight, own write done, clean reload, dirty notice, same text on both sides, an answer not asked twice, asked again for new disk text, gone or unreadable). The check around it, with the read in the middle: `external-check.test.ts` (the Document is judged after the read; a change that arrives during a read is read again). The External Cause: `recorder.test.ts`, `hub.test.ts` (an External Version is written under the open file's key; no saved mark). 2143 tests in 124 files |
| An edit by Claude Code shows up in the open file and in its Timeline as an External Version | Pass | A clean `alpha/SKILL.md`: an in-place write ([33-1](img/33-1.png)) and a write-temp-then-rename ([33-2](img/33-2.png)) both reloaded the Document with "Reloaded SKILL.md: it changed on disk", and the Timeline got an External dot each time (the dot appears a moment after the toast: the History list is read again after the write). Full history ([33-7](img/33-7.png)) lists the entry as EXTERNAL "Changed outside Chiri" with the lines it changed |
| A `git pull` that rewrites the open file shows up the same way | Pass | `delta/SKILL.md` open through the Library (its folder is a link into a clone). A commit pushed from the other clone changed nothing on screen; `git pull` in the first clone reloaded the Document and added an External Version ([33-10](img/33-10.png)) |
| A Save by the app records no External Version | Pass | Typed text, `Ctrl+S`: "Saved SKILL.md" ([33-3](img/33-3.png)), one new dot, "You added 4 words" (the Edited Version a Save records first). The two External dots from before stayed two after 3 s, and the file on disk held the typed text. The own-write guard is the pair `writing` (the text in flight, set by `onSaving`, cleared by `onSaveEnded` in a `finally`) and the saved text, both unit-tested |
| An edit while the Document is dirty is never overwritten without a choice | Pass | Typed " MINE unsaved." (dot on), then an agent's in-place write: the notice appeared and the Document kept my text ([33-4](img/33-4.png)). `Ctrl+S` left the file's SHA-256 as the agent wrote it. "Keep mine" hid the notice and kept the dot; an edit to a sibling file did not bring it back; `Ctrl+S` showed it again with the file unchanged ([33-5](img/33-5.png)). A second agent edit (a rename-over) raised it again; "Reload from disk" took the disk text, clean, with an External Version, and the unsaved text it replaced is the Edited Version "You added 2 words" before it ([33-6](img/33-6.png), [33-7](img/33-7.png)) |
| A skill added, removed or renamed shows up in the Library without a restart, including one behind a symlink that points outside the roots | Pass | A folder with a `SKILL.md` added to a root: listed, count 4 → 5 ([33-8](img/33-8.png)). Frontmatter `name` changed: shown under the new name. Folder renamed: still listed, as its frontmatter says. Folder removed: gone, 5 → 4. Behind a link to `outside/`: `gamma`'s description edited in its real folder (updated); a new skill `zeta` created outside and linked in (listed, then its description edited there: updated) ([33-9](img/33-9.png)); `zeta`'s target removed (gone) and made again (back: the case that needed the anchors below); `gamma`'s folder deleted and made again (gone, back, and an edit after that was seen: a new watch on the new inode). A project root added through the Add stub was watched at once: a skill created in it appeared with no Refresh |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; screenshots in `docs/chiri/verification/` | Pass | 2143 tests in 124 files; Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/`. No `sk-or-` string in `dist/` or `out/` |

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| A file outside every root is followed | Pass | `note.md` opened with the Open stub from a folder outside the roots, then written in place: reloaded, External dot. The open file's folder is in the watch plan, told to the main process by `watchFile` |
| The open file is deleted | Pass | `note.md` removed while open: the notice "note.md changed on disk"; "Reload from disk" said "Could not reload note.md: File not found" and kept the text ([33-11](img/33-11.png)). Save would answer a conflict, as in #30 |
| A link whose target is gone, and a root that does not exist | Pass | The first is the `zeta` case above. The second is a unit test (`external-changes.test.ts`: the nearest existing parent of the root is watched); not forced in the window |
| A real folder deleted and made again | Pass | `gamma` above. Node's docs say the old watch emits one event and goes quiet; `node-watch.test.ts` shows it on this machine (a write in the new folder is not seen) and shows that `directoryIdentity` differs, which is what makes the controller open a new watch |
| A folder made first, its `SKILL.md` written later (review finding 1) | Pass | A folder with only a `notes.md` sat in the root for 4 s (not listed), then a `SKILL.md` was written: `theta` listed within 2 s ([33-12](img/33-12.png)). A link to a folder that was still empty (`kappa`), 3.5 s later a `SKILL.md` in its target: listed. Both failed in `external-changes-fs.test.ts` with the old plan (only loaded skills watched) and pass now, against real `fs.watch` |
| A default root under a hidden folder comes back (review finding 2) | Pass | `~/.agents` removed (the root became "not found"), then `~/.agents/skills/zz` created: the root and `zz` were listed with no Refresh ([33-13](img/33-13.png)). The creation event of `.agents` is a hidden name, which is dropped unless a watched parent is waiting for that name. Also real-folder tests for a root and for a link target under a hidden folder |
| Two `watchFile` asks finishing out of order (review finding 3) | Pass by tests | `external-changes.test.ts`: the real path of the first ask is answered after the second's (and after a `null`): only the last ask's folder stays watched. Not forced in the window, where a real path resolves in microseconds |
| The app's output | Pass | No exception and no "Could not watch" line from the main process; the only errors were the headless GPU's vsync messages |

## What the first run found

My first pass over the Library checks, before the anchors, ended with `zeta` and `gamma` gone after their target was removed and **not coming back** when it was made again: once a skill leaves the listing, nothing watched the folder that held its target, and the link in the root did not change. The watch plan now adds, for each link in a root that points at nothing, the nearest existing parent of where it points (`danglingLinkTargets`, a real-folder test), and the same for a root that does not exist. That is the one design change the checks caused; every check above was run again on the final build.

## For the maintainer's manual test

These need a real session or a real repo of yours, which I must not touch:

1. **A real Claude Code edit.** `pnpm dev:electron`, open a skill's `SKILL.md` from the Library, leave the Document clean, and ask Claude Code (in a terminal) to change that skill. The Document should follow, a toast say "Reloaded SKILL.md: it changed on disk", and the Timeline get an External dot. Repeat after typing in the Document first: the notice must show and your text stay.
2. **A real `git pull` on one of your own skills** (one that is a clone, or a link into one). Open its `SKILL.md`, then pull a commit that changes it: same result as above.
3. **A skill added by an agent** (for instance asking Claude Code to create a new skill in `~/.claude/skills`): it should be listed within a second, with no Refresh.
4. **The inotify limit** (rare): with very many watches the main process logs "Could not watch …" and the Library falls back to Refresh for that folder.

## Not checked

- The window's own close button and a real GTK dialog (the stub answered every pick, as in #30 and #31).
- A very large burst (hundreds of files in one `git pull`): the batch collapses to folders above 200 paths, and that is a unit test; the largest pull here changed one file.
- Network file systems and Windows or macOS (Linux first, [0013](../adr/0013-native-app-on-electron.md)); Node's docs say `fs.watch` is unreliable on network file systems.
- A root that never existed, created later (the hidden-folder case was driven with a root that was removed and made again; the never-existed case is a unit test).

## Decisions worth a look in review

- **The renderer decides, the main process only reports.** The disk text is compared with the session's saved text, which only the renderer has, so the main process keeps no per-file state ([0014](../adr/0014-skills-on-disk.md)). The cost: the renderer reads the file on every push that touches it, one read of at most 5 MiB.
- **Own writes are two checks, not one.** The saved text covers a Save that has finished; the text in flight covers a watcher event that wins the race against the Save's answer. Without the second, a Save could be reported as an External change.
- **A clean reload keeps your place.** `refreshDocument` sends CodeMirror the smallest change (shared prefix and suffix, never splitting a surrogate pair), so the cursor and scroll stay and undo takes one step back to the old text.
- **"Reload from disk" records an External Version** (it used to record Opened): the text came from outside. That changes #30's behaviour on purpose; the seam is `onReloaded` in `App`.
- **`fs.watch`, no dependency.** Folders only, not recursive; the plan lists every folder under a root, skill or not, and every folder the scan reaches inside a skill (up to its depth of 3). An empty subfolder of a skill is not watched until the skill folder next reports a rename. Chokidar and `@parcel/watcher` would add a dependency for what this needs, and `@parcel/watcher` a native module.
- **`LibraryKit.subscribe` is required**, `kit.external` is optional: the Web build has neither.

## Review of PR #40 (first pass, opus) and the fixes

The review confirmed the dirty path, the own-Save handling, the IPC checks and the StrictMode unsubscribe. Three findings, fixed test first:

| # | Finding | Fix | Test |
|---|---|---|---|
| 1 | High: only folders already recognised as skills were watched, so `mkdir foo`, then a `SKILL.md` seconds later (how agents create a skill), or a new link to a still-empty folder, lost the creation of the `SKILL.md` until a restart | The plan watches every folder under a root and every link that points at a folder (`rootEntries`), with the real target and the folder holding it. After a scan opens new watches, the scan runs once more; a different listing is announced (`{ paths: [], library: true }`) and planned again. `FolderWatcher.sync` now says how many watches it opened | `plan-watches.test.ts`, `folder-watcher.test.ts`, `external-changes.test.ts` (candidate folder, link to an empty folder, recovery scan, no loop) and `external-changes-fs.test.ts` (real `fs.watch`; two of its three cases fail without the fix) |
| 2 | Medium: a missing root under a hidden folder (`~/.agents`, `<project>/.claude/skills`) or a link target inside one never came back, because the creation event of the hidden name was dropped | Each missing path now records the name it waits for in its watched parent (`awaitedBy`); `classifyEvents` lets that one name through the hidden filter, in that folder only | `classify-changes.test.ts`, `external-changes.test.ts` (root and link target under hidden names), `external-changes-fs.test.ts`; ADR 0014 corrected |
| 3 | Low: `watchFile` assigned the open file after `await realPath`, so quick switches could leave the first file's folder watched | A sequence token per ask; a stale answer is dropped | `external-changes.test.ts` (out of order, and a late answer after `null`) |

2143 tests in 124 files, Biome clean and `pnpm build` green after the fixes. The headless checks of findings 1 and 2 were run on the fixed build.
