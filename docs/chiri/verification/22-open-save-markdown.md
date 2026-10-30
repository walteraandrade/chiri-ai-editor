# PR #22 verification: open and save Markdown files

No issue: the maintainer asked for it directly ("import `.md` files from our file system, and save"), ranked above the backlog. Decisions in [ADR 0011](../adr/0011-open-and-save-markdown-files.md). Checked on 2026-10-30 in a real browser (`agent-browser`, headless Chrome, 1440 x 900) against `pnpm dev`.

```text
App
  useMarkdownFile                         # file session, Open / Save, Cmd/Ctrl+O / S / Shift+S, tab title
    openMarkdownFile(host, fallback)      # showOpenFilePicker, or the hidden <input type="file">
      DocumentControls.replace(text)      # stop a Review pass → clearSuggestionsEffect → one history step
    saveMarkdownFile(host, fallback, …)   # same handle, showSaveFilePicker, or a download
    nextFileSession(session, event)       # opened | saved | edited → name, handle, savedText, dirty
  FileName  FileControls
```

Headless Chrome cannot show the native pickers, so the checks replaced `window.showOpenFilePicker` / `showSaveFilePicker` with fakes that hand out in-memory file handles and record each write. The app code ran unchanged on top of them. For the Firefox / Safari path, the pickers were set to `undefined`, the hidden input's `click` was stubbed (headless Chrome cancels the real dialog at once), the file was set with `agent-browser upload`, and `<a download>` clicks were recorded with the Blob text.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `markdown-file.test.ts` (byte order mark, name from the first `#` heading, accents, length cap, fallback name), `file-session.test.ts` (dirty flag, same session when unchanged, text edited during a save), `file-access.test.ts` (both pickers, cancel, other errors, Save in place, Save as, download), `browser-files.test.ts` (change, cancel, a stuck pick replaced by a new one), `file-commands.test.ts` (keys per platform), `state.test.ts` (`clearSuggestions`), `document-commands.test.ts` (replace, Suggestions dropped without a notice, one undo step). `pnpm test`: 713 green |
| Save with no file yet | Pass | `Ctrl+S` on the sample: save picker with `suggestedName: release-process-update-weekday-deploys.md`, 1910 characters written, toast "Saved release-notes.md", name in the header, tab title `release-notes.md · Chiri` |
| Unsaved changes, then Save in place | Pass | Typing shows the dot and `• release-notes.md · Chiri` ([open-save-1](img/open-save-1.png)). `Ctrl+S` writes 1918 characters to the same handle with no picker; the dot goes away |
| Open | Pass | Open button: `notes.md` with a byte order mark loads as `# Notes\n\nOpened from disk.\n`, cursor at 0, editor focused, toast, `localStorage` updated by autosave |
| Undo past Open | Pass | `Ctrl+Z`: the previous text is back and the dot shows (it differs from `notes.md`). `Ctrl+Y` twice: back to the file, dot gone |
| Cancel | Pass | Both pickers throwing `AbortError` (`Ctrl+O`, `Ctrl+Shift+S`): text, name and toast unchanged |
| Write refused | Pass | `createWritable` throwing `NotAllowedError`: toast "Could not save notes.md", dot stays |
| Save as | Pass | Shift-click on Save and `Ctrl+Shift+S` ask for a new file even with a handle; header and title switch to `copy.md` |
| Open during a Review pass | Pass | Real pass on the sample. At the first Suggestion (3.0 s, toolbar "Reviewing… 1 suggestion"), `Ctrl+O`: toolbar back to "Review", no Suggestions, no Discard toast, toast "Opened notes.md". 6 s later still none: the aborted stream added nothing |
| Firefox / Safari path | Pass | Open twice (the first pick never settles), then the upload: the first pick is dropped and the second loads `firefox-notes.md`, byte order mark dropped, CRLF shown as LF ([open-save-2](img/open-save-2.png)). `Ctrl+S`: one download named `firefox-notes.md` with the edited text, toast "Downloaded firefox-notes.md" |
| Narrow window | Pass | 760 px: name, hint and buttons stay on one line |

Found while checking, and fixed: the first build guarded Open and Save with a busy flag. When headless Chrome's file input fired neither `change` nor `cancel`, that flag stayed set and Open and Save stopped working until a reload. The flag is gone (key repeat is ignored instead), and a new pick on the input settles the old one.

## AI call records

One Review pass, aborted on purpose by the Open. OpenRouter returns no usage for an aborted stream, so the in-page record has no generation id, tokens or cost. The cost is the key's `usage_daily` counter after the check, the only call on the key that day.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review document → default criteria (aborted by Open) | openai/gpt-6.1-terra | – | – / – / – / – | 0.001328 (daily counter) | 2786 (first Suggestion 2704) / – / – | – | error: aborted | – |

Total: US$0.001328 for 1 call.
