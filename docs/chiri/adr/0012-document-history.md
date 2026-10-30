# 0012. Document History

- Status: Accepted (2026-10-30)
- Source: maintainer request after the submission (change history). The layout was picked from a throwaway prototype with five variants; the maintainer chose E, a Timeline bar plus a Full history page.

## Context

`Cmd+Z` covers one session and shows nothing. There was no way to see how the Document got where it is, or which changes came from the AI. The challenge lists "version history showing how the document evolved with AI help" as a spark; the backlog had it out of scope.

## Decision

- **A Version is a copy of the whole text**, with a Cause and a time. Causes: Started (first Version when no History is stored), Edited (your edits), Accepted (one or more Suggestions, each with its Instruction, Rationale and origin), Opened (file name), Restored (which Version). Saved is a mark on a Version, with the file name, not a Version of its own.
- **When a Version is recorded:**
  - Accept records one Version; Accept all records one Version that lists every accepted Suggestion. The editor tells them apart by the `input.accept` user event and reads the Suggestions from the state before the transaction.
  - Open and Restore record a Version once the text is replaced.
  - Your edits (typing, paste, undo, redo, anything that is not an Accept, Open or Restore) wait as pending edits. They become one Edited Version after 30 s without a change, right before any other Version, or when the page hides.
  - Save marks the Version holding the saved text, recording it first if needed. Edits typed while Save waits (Chrome's permission prompt) stay pending and come after it.
  - A Version with the same text as the last one is not recorded.
- **Pending edits never mix with the AI's.** They become their own Edited Version before an Accepted one, so an Accepted Version holds only the Suggestions' changes.
- **Storage:** `localStorage`, key `chiri.history`, next to the Document. At most 50 Versions; the oldest go first. If the browser refuses the write (quota), the newest 10 are stored, then only the newest; the session keeps all of them in memory. The Document comes first: if its autosave is refused, the stored History shrinks to 10, then 1, then none, until the Document fits. Stored data that does not parse starts a fresh History. If the stored History ends with a text other than the Document's, an Edited Version is recorded on load.
- **Timeline:** a bar under the header with one dot per Version, evenly spaced; spacing by time would stack a Review pass's dots. The mark shows the Cause; Accepted dots use the accent. Hover or focus shows the Cause, time and Rationale. One tab stop; arrow keys, Home and End move between dots and show the Version they land on. Clicking a dot shows that Version in place of the editor, marked against the current text, so the marks are what Restore would change. Older / Newer step through Versions; `Esc` goes back to the editor, and so do starting a Review pass, Accept all, Reject all and Open.
- **Full history:** a button at the end of the Timeline opens "How this Document changed" in place of the editor: one entry per Version, newest first, with its Cause, Rationale and only the lines that changed against the Version before. Hovering an entry lights its dot; clicking a dot scrolls to its entry. Entries offer "View in Timeline", not Restore: Restore happens only after seeing what it changes.
- **Restore:** replaces the text the way Open does ([0011](0011-open-and-save-markdown-files.md)): it stops a Review pass, drops every Suggestion and takes one undo step. Then it records a Restored Version. Nothing is removed from History.
- **Diff in the history views:** line by line. A run of changed lines gets the adaptive diff ([0003](0003-adaptive-diff.md)). Pairing whole Blocks would turn a two-item edit in a list into the whole list struck out (seen in the prototype).

## Consequences

- The Document is no longer the only thing the app persists. Clearing site data clears both.
- 50 copies of a large Document can reach the `localStorage` quota; History then keeps fewer Versions.
- Edits from the last 30 s before a crash (not a normal close) never become a Version; the Document autosave still has them.
- Restore, like Open, drops open Suggestions for good.
- Undoing an Accept shows up as an Edited Version, not as an AI change taken back.
- A Review pass accepted one Suggestion at a time gives one entry per Suggestion; Accept all gives one entry for all of them.

## Alternatives considered

- **Log of accepted Suggestions only:** small, but no Restore, and your own edits vanish from the story.
- **Unlabeled copies every N seconds:** simple, but it cannot tell how the AI helped.
- **Store diffs instead of copies:** smaller, but Restore needs a replay, and one bad step breaks every Version after it.
- **Other layouts from the prototype:** a left rail competes with the margin cards; a drawer covers them; a Timeline alone needs hover to read anything; a Full history page alone has no quick overview.
- **IndexedDB:** more room, but async and more code. Not needed at 50 Versions of a ~2 KB Document.
- **History in memory only:** no storage decision, but a reload wipes the story.
