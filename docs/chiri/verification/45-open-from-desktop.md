# Issue #45 verification: Open Markdown files from the desktop

Issue [#45](https://github.com/walteraandrade/chiri-ai-editor/issues/45), stacked on `feat/open-save-markdown` ([PR #22](https://github.com/walteraandrade/chiri-ai-editor/pull/22)): built and checked on 45b492c, then rebased onto 763d1e6 (#44, AI motion and the Omarchy theme) and re-checked. Checked on 2026-11-02 in the packaged app (`pnpm package:dir`, `release/linux-unpacked/chiri-ai-editor`), Electron 43.8.6:

- **Runs:** `gamescope --backend headless -W 1440 -H 900` (nothing on the Hyprland screen), a throwaway `HOME` and `--user-data-dir=<temp>`, `--remote-debugging-port`, attached with `agent-browser connect`. The files were temp files; no real skill or note was touched.
- **Second launches** ran outside gamescope against its X display (`DISPLAY=<gamescope's>`, `WAYLAND_DISPLAY` unset) with the same `--user-data-dir`, so they met the first instance's lock.
- **Key dialog:** the dummy key `sk-or-v1-dummy-for-tests` in a throwaway `userData`. The maintainer's key file was not touched; the keyring only holds the password that encrypts that file.
- **No model calls**, so no AI call records ([ai-costs.md](../ai-costs.md) says so).

```text
main process
  registerLaunches
    createLaunchQueue.offer(process.argv, cwd)      first Markdown argument: path or file:// URL, switches skipped → realpath
    app.on('second-instance', argv, cwd)            offer → bring the window forward → send launch:file
    ipc launch:take                                  the waiting path, once (trusted frame only)
  requestSingleInstanceLock()                        lost → quit before ready
renderer (Electron kit)
  start: launches.take() → reopen(launched) → else reopen(last file)    launched file becomes the last file
  App: launches.subscribe → file.openRef(ref)        Save / Discard / Cancel first, like a Library click
KeyDialog
  save | Store as plain text → savedKeyMessage(state) → Toast + close   stays open while plain text is still offered
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD on the parsing, the queue, the start order and the saved-key message | Pass | `launch-queue.test.ts` (14) and the 4 `savedKeyMessage` cases in `key-status.test.ts` were red first. `electron-launches.test.ts` (6) and the 5 new cases in `electron-kit.test.ts` were written next to their code, so they were mutation-checked instead: 8 mutations (start-up take dropped, a null path delivered, a thrown take, unsubscribe ignored; last file not saved, launch notice dropped, launched file ignored, launches not carried), each caught by at least one test. |
| `chiri-ai-editor <file>.md` opens that file | Pass | Started with an absolute path to `first.md`: title `first.md · Chiri`, the Document is the file's text ([45-1](img/45-1.png)) |
| A second launch hands its file to the running window | Pass | `second.md`, relative to a working directory with a space in it (`notes/my notes`): the open window switched to it, no second window ([45-2](img/45-2.png)). The second process printed Wayland errors because it had no Wayland display; the lock had already handed the file over |
| Unsaved text asks first | Pass | After typing into `second.md` (dot in the title), a third launch as `file://…/third.markdown` with `--ozone-platform=x11` in front of it: "Save changes to second.md?" with Cancel / Discard / Save ([45-3](img/45-3.png)). Save wrote the edit to disk (read back with `cat`), then `third.markdown` opened ([45-4](img/45-4.png)) |
| A launched file that does not exist | Pass | Restart with `missing.md`: the notice "Could not open missing.md: File not found", and the last file (`third.markdown`) reopened ([45-5](img/45-5.png)) |
| `MimeType` in the desktop entry | Pass | `pnpm package`; inside `release/chiri-ai-editor-0.0.0.pacman`, `usr/share/applications/chiri-ai-editor.desktop` has `MimeType=text/markdown;text/x-markdown;` and `Exec=/opt/Chiri/chiri-ai-editor %U`. No file under `usr/share/mime` in the package |
| Key dialog closes once the key is stored | Pass | Key → dummy key → `Enter`: no `<dialog>` left, the "key missing" banner gone, Toast "Key saved in the system keyring." ([45-6](img/45-6.png)); Key again: "Stored in the system keyring (gnome_libsecret)." |
| `pnpm test`, `pnpm biome check`, `pnpm build` | Pass | 2568 tests in 148 files on 45b492c; after the rebase onto 763d1e6, 2627 in 156. Biome clean; both `tsc`, Web `dist/` and Electron `out/` built |
| After the rebase | Pass | Rebuilt package: started with `first.md`, then a second launch as `file://…/third.markdown` switched the window to it |

## On the maintainer's machine

- The package was installed with `pacman -U` and set as the default with `xdg-mime default chiri-ai-editor.desktop text/markdown text/x-markdown`. Before, `text/markdown` pointed at `code.desktop`, which is not installed, so Typora won.
- `gio mime text/markdown` names `chiri-ai-editor.desktop`. GIO (file managers, file pickers, the portal) types a file by its name, so `.md` opens in Chiri there.
- **`xdg-open` in a terminal still opens `.md` in the `text/plain` app (nvim).** xdg-utils 1.2.1 on Hyprland runs in its generic mode and types the file with `file --mime-type`, which says `text/plain` for this repo's `README.md`. Installing `perl-file-mimeinfo` would make it type by name, but the same check showed `.ts` as `text/vnd.trolltech.linguist`, `.tsx` as `application/x-tiled-tsx` and `.lua` as `text/x-lua`, none with an app. Left as is; a small `~/.local/bin/xdg-open` wrapper is the option if the terminal should open Chiri too.

## Not checked

- Native Wayland: whether Hyprland lets the second launch bring the window forward (focus stealing prevention may mark it urgent instead).
- A double-click in Nautilus. `gio mime` and the desktop entry are checked, the click is not.
- Two launches in quick succession while the first one's question is open: each asks its own Save / Discard / Cancel, as two quick Library clicks do today.
