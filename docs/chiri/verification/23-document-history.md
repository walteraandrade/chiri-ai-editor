# PR #23 verification: Document History

No issue: the maintainer asked for a change history on top of PR #22. Decisions in [ADR 0012](../adr/0012-document-history.md). The layout came from a throwaway prototype with five variants in the real app (left rail, drawer, Timeline, Full history page, and E: Timeline plus Full history); the maintainer picked E. Checked on 2026-10-30 in a real browser (`agent-browser`, headless Chrome, 1440 x 900) against `pnpm dev`.

```text
main.tsx
  loadHistory → resumeHistory → createHistoryRecorder({ persist: saveHistory, idleMs: 30 s })
  pagehide / hidden → history.flush()
App
  EditorPane
    historyEvents (updateListener) → historyEventOf(transaction)
      input.accept            → accepted { before, text, changes }   # Suggestions read from the state before
      input.open / restore    → replaced { before }
      anything else           → edited { text }                      # pending until 30 s idle
    applyHistoryEvent(recorder, event)
  useMarkdownFile({ onOpened, onSaving, onSaved }) → recorder.opened / recorder.saving / recorder.saved
  useHistoryView(recorder) → useSyncExternalStore, nextHistoryMode, Esc, flash
    Timeline       # one dot per Version, roving focus, tooltips
    VersionBar     # Older / Newer / Restore / Back, in the sticky header
    LineDiff       # lineChanges: line runs, adaptive diff inside a run
    FullHistory    # "How this Document changed"
```

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `history.test.ts` (start, record, skip equal text, cap at 50, Save mark, resume), `recorder.test.ts` (idle delay, pending edits before an Accept, replace, Open, Restore, Save, edits typed while Save waits, an Accept during a Save, typing then an Accept during a Save, a Version when Save starts, saving a text that went back to an older one, flush once, no persist without a change, subscribers, clock), `storage.test.ts` (round trip, bad JSON, bad shapes, quota fallback to 10 then 1, `makeRoomFor` shrinking the History to 10, 1 or none until the Document fits), `line-changes.test.ts` (word change in a line, only changed list items, two lines replaced by one, a deleted block before kept lines, added and removed lines, trailing newline, word counts), `story.test.ts` (each Cause's label and headline, Review pass Focus, Accept all, summary, marks), `view-mode.test.ts` (show, step, toggle, close, missing Version, keys), `time.test.ts` (both `formatClock` branches), `file-actions.test.ts` (Save reports its text before the picker answers), `events.test.ts`, `history-events.test.ts` (typing, Accept, Accept all, Open, Restore, no text change). `pnpm test`: 823 green |
| Fresh start | Pass | Empty storage: one Started dot, `chiri.history` stored |
| Accept | Pass | More formal on the title Block, Accept: an accent dot "AI · More formal" with the Rationale, stored with origin `ask` ([history-1](img/history-1.png)) |
| Your edits | Pass | Typing, then 30 s idle: a "You added 3 words" dot |
| Version view | Pass | Clicking the Started dot hides the editor and shows the whole text marked against now, with Older / Newer / Restore / Back in the header ([history-2](img/history-2.png)) |
| Restore | Pass | Text back to the sample, editor shown and focused, toast "Restored the Version from 08:54 AM", a Restored dot. `Ctrl+Z` brings the text before the Restore back |
| Full history | Pass | Newest first, kind line, headline, only the changed lines ([history-4](img/history-4.png)). Hovering an entry lights its dot; clicking a dot scrolls to its entry and flashes it; `Esc` goes back to the editor with focus |
| Save | Pass | Fake save picker: the last Version gets `saved: release-notes.md`, shown in the tooltip and the Full history |
| Open | Pass | Fake open picker: an "Opened notes.md" Version |
| Reload | Pass | All 6 Versions back after a reload; the Document is the opened file ([history-5](img/history-5.png)) |
| Accept all | Pass | Real Review pass on the restored sample, Accept all: one Version with 5 changes, all origin `review`; the Full history lists the 5 Rationales once ([history-6](img/history-6.png)) |
| Restored Version against now | Pass | [history-7](img/history-7.png) |
| Bundle | Pass | The first build validated stored History with `zod`, which moved it from the lazy AI chunk into the main one (792 → 907 kB, over the 900 kB warning). Replaced by a small hand-written check: main chunk 809 kB, AI chunk unchanged, no warning |
| Quota fallback in a real browser | Not checked | Covered by `storage.test.ts` with a storage that throws past a size |
| 50-Version cap in a real browser | Not checked | Covered by `history.test.ts` |

Found while checking, and fixed:

- A dot's accessible name began with its label, so a Restored dot was named "Restore, …" like the Restore button. Dots now start with the time ("08:55 AM, Restored: …"), and the label reads "Restored".
- A changed heading line lost its heading size in the Version view.
- The Review button worked while a Version was shown (see below).
- An Accept all repeated "Review pass:" before every Rationale; the label now shows only when the Suggestions came from different requests.

## Review

First pass (`opus`, Standards and Spec). Fixed:

- Save while Chrome's permission prompt waits, with typing meanwhile, put the History out of order: the newer edits became a Version, then the older saved text a second one, as if words were removed. Save now marks the saved text first and keeps the newer edits pending (completed by the second and third checks below).
- A full History could take the room the Document's autosave needs, and the autosave failure was silent. The autosave now shrinks the stored History (10, then 1, then none) until the Document fits (`makeRoomFor`).
- Open while a Version or the Full history was shown kept that view over the opened file; Open now goes back to the editor.
- `formatClock` read the clock by default and had no tests; `now` is required and both branches are tested. A mixed Accept all label, two `lineChanges` cases and a few unknown-id paths gained tests. One `countWords` instead of three. `lineChanges` is a `flatMap` instead of a loop. Labels follow the Glossary: "Started", "Opened", "View in Timeline".
- ADR 0012 now says that the arrow keys show the Version they land on, that the Document comes first in storage, and how Save orders Versions.

Second pass (`sonnet`): one more real finding, fixed. An Accept or a Restore while Save waited still put the saved text after the newer Version. Save now marks the newest Version holding the saved text and records one only if none does. Also from that pass: a test for the "keep 1" step of `makeRoomFor`, a test that makes the Save flush matter (edits back to an older text become a new saved Version), the ADR wording for arrow keys with the Full history open, the cost sum, and a fresh [history-4](img/history-4.png) with the new labels (taken on a seeded History, no model call). It mutation-tested the fixes in a copy of the repo: 19 mutants, 15 caught. Of the 4 that survived, two were the gaps above, now covered (each mutant rechecked: it now fails a test); one dropped the null-storage guard in `makeRoomFor`, which behaves the same because the write then throws and is caught; one put back `formatClock`'s default `now`, which only the type checker guards.

Third check (`sonnet`, on the second fix): one narrow case left. Typing during the wait replaced the pending text Save had captured, so an Accept during the same wait still put the saved text last. Fixed at the root: Save now records its text as a Version when it starts (`onSaving` in `createFileActions` → `recorder.saving`), so the mark at the end always finds it. Rechecked in the browser with a fake picker that waits 300 ms: the Edited Version appears as Save starts and gets the `notes.md` mark when it ends.

Fourth check (`sonnet`, on that fix): clean. It ran `createFileActions` and the recorder together through typing, Accept and Restore during the wait, cancel, a failed write, two Saves, the download path and a Review pass; every History came out in order. Three nits fixed: a stale diagram line here, a recorder test whose title did not match it, and a test that a Save skipped by the one-at-a-time lock does not record. The `onSaving` wiring in `useMarkdownFile` and `App.tsx` has no unit test; it was checked in the browser.

Not rechecked in a browser after the review: the autosave calling `makeRoomFor` in `main.tsx` (covered by `storage.test.ts`; filling a real quota needs megabytes of text). Open closing the history view was rechecked with a fake picker.

Left as is: Open of a file whose text equals the Document records no Opened Version (the equal-text rule); with 50 Versions stored, a new Version can trim the one being shown, which sends the view back to the editor.

## AI call records

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cursor at the Document start → More formal (title Block) | openai/gpt-6.1-terra | – (record lost on a reload) | – / – / – / – | ~0.0013 (daily counter) | – / – / – | – | 1/1, accepted | – |
| review document → default criteria (started by mistake while a Version was shown; 6-word Document) | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026, OpenAI | 416 / 22 / 9 / 0 | 0.000526 | 2435 / 1754 / 1855 | stop | 1/1, no Suggestions | gen-1793361409-2zZ2burIgcRCLsVONgaC |
| review document → default criteria, then Accept all | openai/gpt-6.1-terra | openai/gpt-6.1-terra, OpenAI | 975 / 324 / 0 / 0 | 0.002595 | 5412 / – / – (first Suggestion 2133) | stop | 1/1, 5 Suggestions | gen-1793361428-wBR2yXFlsbhTNe00ezU6 |

Total: about US$0.0044 for 3 calls. The first row's cost is the key's `usage_daily` counter (US$0.005754 after the check) minus PR #22's call and the two recorded rows.

The second call showed a gap: the Review button stayed live while a Version was shown, so the pass ran on the hidden editor. Fixed: starting a pass, Accept all and Reject all now go back to the editor first (`beforeReviewChanges`, tested). Rechecked with `window.fetch` stubbed to never answer, so no request reached OpenRouter: Version shown → Review → the editor is back and the pass is running; Stop ends it.
