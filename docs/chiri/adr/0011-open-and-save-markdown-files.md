# 0011. Open and save Markdown files

- Status: Accepted (2026-10-30)
- Source: maintainer request after the submission ("import `.md` files from the file system, and save"), ranked above the backlog

## Context

`localStorage` was the Document's only home ([0007](0007-suggestion-lifecycle.md)). It is tied to one browser profile, cleared with site data, and holds one Document. Pasting covered bringing text in; nothing covered taking it out.

## Decision

- **Still one Document.** Open replaces it; it does not add a tab. Multiple documents stay out of scope ([BACKLOG.md](../../BACKLOG.md)).
- **File System Access API where it exists (Chrome, Edge):** Open uses `showOpenFilePicker` and keeps the file handle. Save writes back to that file without asking. Save as, or Save with no file yet, uses `showSaveFilePicker`, suggesting a name from the first `#` heading (`release-notes.md`; `document.md` without one). Both pickers share an `id`, so they reopen in the last folder.
- **Elsewhere (Firefox, Safari):** Open uses a hidden `<input type="file">`. Save downloads a copy with the same name each time; the browser decides where it lands.
- **Open:** first stops a Review pass in flight, then drops every Suggestion (ready, pending or failed) without a Discard notice, then replaces the whole text in one isolated history step, cursor at the start. `Cmd+Z` brings the previous text back.
- **What is written:** the Document text only. Suggestions are overlays and never reach the file ([0001](0001-inline-overlay-suggestions.md)). A leading byte order mark is dropped on Open; CodeMirror normalizes line endings, so a CRLF file is saved with LF.
- **File state:** name, handle and the last saved text live in memory. The header shows the name and a dot while the text differs from it; the tab title does the same. A reload keeps the Document (`localStorage` autosave is unchanged) but forgets the file, so the next Save asks where.
- **Keys:** `Cmd/Ctrl+O` Open, `Cmd/Ctrl+S` Save, `Cmd/Ctrl+Shift+S` Save as, anywhere on the page. Shift-click on Save is Save as.
- **Failures:** a cancelled picker does nothing. A failed read or write (permission denied, file gone) shows a toast and keeps the dot.

## Consequences

- A Document can now live in a real file, and Chrome users get the usual Save loop.
- Undoing past an Open puts the old text back under the opened file's name; the dot shows it, and Save would write it there.
- Opening a file drops open Suggestions for good, like Reject.
- Firefox and Safari users collect copies in their downloads folder.

## Alternatives considered

- **Download-only everywhere:** one code path, but no Save in place on any browser.
- **`browser-fs-access` library:** wraps the same two paths. About 60 lines of our own code do what we need, without a dependency.
- **Confirm before Open when the text is unsaved:** a dialog on every Open of an edited sample; the undo step keeps the old text without one.
- **Fresh `EditorState` on Open:** clears history and Suggestions at once, but loses the old text, and the Review runtime is built to live as long as the view.
- **Keep the handle in IndexedDB across reloads:** Save in place after a reload, at the cost of a permission prompt and more code. In the backlog.
