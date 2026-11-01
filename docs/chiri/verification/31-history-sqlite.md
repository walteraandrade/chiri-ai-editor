# Issue #31 verification: History store, `history.sqlite` in the Electron build

Issue [#31](https://github.com/walteraandrade/chiri-ai-editor/issues/31), stacked on [PR #37](https://github.com/walteraandrade/chiri-ai-editor/pull/37) (#30, Files through `DocumentFiles`). Checked on 2026-11-01 with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy. Nothing was shown on the desktop: the Electron window ran inside a headless `gamescope`.

- **Electron build:** `CHIRI_DEV_PORT=5303 CHIRI_CDP_PORT=9303 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> gamescope --backend headless -W 1440 -H 900 -- env -u WAYLAND_DISPLAY ELECTRON_OZONE_PLATFORM_HINT=x11 pnpm dev:electron`, attached with `agent-browser connect 9303`.
- **Web build:** `CHIRI_DEV_PORT=5303 pnpm dev` in `agent-browser`'s own Chrome.
- **Skills:** a temp root in the session's scratch folder, never a real skill folder: `alpha/SKILL.md` and `beta/SKILL.md`. Open went through `CHIRI_DEV_PICK_FILE` (the dialog stub of #30), every time.
- **Seed:** `alpha` got 220 Versions from a throwaway script that calls the app's own `openHistoryDb` on the temp `userData` before the first start. The script is not committed. Every Version after those 220 was made through the app.

```text
before  kit.history: HistoryRecorder  (in-memory History, persist(history) rewrites the whole array)
        Electron kit: one localStorage History, unsaved text and Document in localStorage, flushStorage to disk
after   kit.history: SwitchableHistory<Ref>  → DocumentHistory (one per key) → recorder emits writes → HistoryStore
          Web adapter       localStorage, 50 Versions, 0012's fallbacks, key ignored
          Electron adapter  preload historyList · historyText · historyRecord · historyMarkSaved
                            main: validation → history-db.ts (node:sqlite, WAL, one transaction per write)
        kit.unsavedText.offered / UnsavedStore<string> → preload unsavedLoad · unsavedSave · unsavedClear → drafts { text, base_hash }
        History key = real path; no file = scratch:document
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers the recorder events, one store contract run against both adapters (the Electron one on a temporary database), words counted on insert, and equal texts sharing one blob | Pass | Recorder events: `recorder.test.ts`. One contract, `src/history/store-contract.ts`, run by `local-store.test.ts` (Web adapter, cap 50) and by `electron/main/history-handlers.test.ts` (SQLite on a temp file, through the same validation the preload goes through, no cap, a History per key). Words and the added / removed counts on insert: the contract (first Version, spacing only, restore of an old text, a save that records a Version) and `history-db.test.ts` (the columns). Equal texts sharing one blob: `history-db.test.ts`, within a file and across files, and for a draft's base. `word-delta.test.ts` keeps `wordDelta`'s cases |
| Electron: 200+ Versions of one file are kept across restarts; opening another file shows its own Timeline; Restore works on an old Version | Pass | Opening `alpha` listed its 220 Versions ([31-1](img/31-1.png)). Restore of the 2nd Version (12:25 PM, [31-2](img/31-2.png)) added a Restored Version: 221 ([31-3](img/31-3.png)). Opening `beta` showed its own Timeline, one Started Version ([31-4](img/31-4.png)); opening `alpha` again showed its 222, the last one the edit typed just before the switch ([31-5](img/31-5.png)). After a `SIGTERM` restart and a `kill -9` restart the Timeline held 223 (the 220, the Restored, the pending Edited and the AI one), then 224 after "Reload from disk" |
| Electron: unsaved text comes back from `drafts` after a killed process | Pass | Accepted a Suggestion (unsaved, dot on), waited 2 s, `kill -9` on my own Electron PID, started again: the last file reopened with the accepted text and the dot ([31-8](img/31-8.png)), 223 Versions. `drafts` held `text`, and `base_hash` of the disk text |
| Web: History behaves as before (50 Versions, kept across reloads, quota fallbacks) | Partly | Started → AI Shorter → typed words, then a reload: all three Versions kept, the Edited one still reading "You added 5 words" ([31-10](img/31-10.png)). The 50-Version cap and the quota fallbacks are unit tests (`store-contract.ts`'s cap case, `local-store.test.ts`: newest 10, newest 1, shrinking to let the Document through, a History stored by the previous format). Not forced in the browser: filling `localStorage` needs `eval` |
| ADR 0015 records the driver | Pass | `node:sqlite`, with the Electron 43.8.6 probe (Node 24.22.1, SQLite 3.53.4, WAL, BLOB round trip) and `better-sqlite3` as the fallback. The schema now has `words_added`, `words_removed` and `drafts.base_hash`; the notes marked #31 say why |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; records and screenshots here, `ai-costs.md` updated | Pass | 1379 tests in 99 files; Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/`. `out/main/index.js` imports `node:sqlite` as an external. No `sk-or-` string in `dist/` or `out/` |

## What the records show

- **Switching files** ([31-4](img/31-4.png), [31-5](img/31-5.png)): the edit typed in `alpha` a few seconds before opening `beta` was recorded as an Edited Version of `alpha` 3 ms before `beta`'s first Version, so the pending-edit rule holds across a switch. The Timeline never shows another file's Versions.
- **The AI Version** ([31-6](img/31-6.png), [31-7](img/31-7.png)): a Quick action on the Block under the cursor, Accept, and the Timeline's dot reads "AI · Shorter" with the model's Rationale. After the `kill -9` it was still there.
- **A file changed while the app was closed** ([31-9](img/31-9.png)): unsaved text, the app stopped, a line appended to the file by hand, started again: "SKILL.md changed on disk", with the unsaved text still in the editor. This only works because `drafts` keeps the base. "Reload from disk" took the disk text and recorded an Opened Version.

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| Closing the window loses nothing (review finding 2) | Pass | Typed, then `SIGTERM` to my own Electron PID within about 250 ms, before the 400 ms unsaved delay: the `drafts` row was written 1 ms after the signal (the `pagehide` flush, not the timer) and the pending Edited Version was recorded at the same time, in a Document with no file and in `alpha`. No "Untrusted sender" in the app's output, so `senderFrame` was not null at that point. This is a shutdown by signal, not a click on a window's close button: a headless gamescope has no window manager |
| `kill -9` keeps the database healthy | Pass | WAL mode, the second start read everything back |
| An unreadable database shows something | Pass by tests | `mountApp` renders `StartError` when the kit factory rejects ([30's check](30-main-process-files.md)); the kit test "does not start when the main process cannot give the unsaved Document". With my own earlier start screen, a `history.sqlite` that was a directory showed "unable to open database file" |
| A failed History or unsaved write tells the user | Pass by tests | `problems.test.ts` (one notice per failure kind, again after a write went through) and the failure cases of `electron-kit.test.ts`. Not forced in the window |
| Phase-1 review fixes | Pass | Writes are sent as they are made (a flush right after an Accept reaches the store before the call returns); a rollback that throws keeps the original error (`transaction.test.ts`, with a trigger that rolls back by itself); the schema version is read and created in one `begin immediate` (`history-db.test.ts`, a second connection creates the schema in between) |
| A list refresh could be lost | Fixed | Found while writing the file-switch tests: a write that settled while the list loop was exiting skipped its refresh. `listing` is now cleared inside the loop (`session.test.ts`, "lists again for writes made right after it started listing") |

## Things to know

- **The Timeline at 220 Versions** is a solid bar ([31-1](img/31-1.png)): the dots are about 2 px wide, so a dot is hard to hit. Older / Newer and Full history's "View in Timeline" reach any Version, and the issue sets no cap, so nothing was changed. A Timeline that groups or scrolls a long History is a follow-up.
- **`chiri.lastFile` is the one thing still in `localStorage`.** Without `flushStorage`, a `kill -9` within about 5 s of opening a file starts the next run on the Document with no file; the file's unsaved text is still in `drafts` and opening the file offers it. Not exercised: it would need a `kill -9` inside that window.
- **Not checked:** the window's own close button, a real GTK Open dialog (every pick used the stub), the quota fallbacks and the 50-Version cap in a real browser.

## AI calls during verification

`window.__aiCalls` was not read: the permission system refused `agent-browser eval`, so the client's own timings and retry flag are missing. The generation ids came from `agent-browser network requests`, and the records from `GET /api/openrouter/generation?id=…` through the Vite proxy. `openai/gpt-6.1-terra` was served by OpenAI as `gpt-6.1-terra-20261026` both times. Latencies are OpenRouter `latency` / `generation_time`, in ms.

| Build | Task | Tokens in / out / reasoning / cached | Cost (US$) | Latency | Finish | Valid | Generation id |
|---|---|---|---|---|---|---|---|
| Electron | cursor in the last Block of `alpha` → Shorter, Accept | 301 / 147 / 40 / 0 | 0.000726 | – / 1919 / 2808 | stop | accepted, not read | `gen-1793559939-cjTDYRZUzruTROTsaRSc` |
| Web | cursor in the last paragraph → Shorter, Accept | 375 / 46 / 0 / 0 | 0.000610 | – / 1174 / 1692 | stop | accepted, not read | `gen-1793560112-UuHWQU97ltGiA6CQPway` |

Total US$0.001336. The key was never printed.

## Decisions worth a look in review

- **One recorder, a store behind it.** The recorder only decides what to write and when; `DocumentHistory` sends each write to the store at once and re-reads the list after a burst. A write is never held behind an earlier one, because the page may be closing.
- **`SwitchableHistory<Ref>`** is the kit's History: `select(ref)` flushes the file being left, then points writes and reads at the new key. The Web kit has one key, so `select` does nothing there.
- **Added and removed words are stored on insert** (two more columns, a field on the Web adapter's stored Version) so the Timeline keeps 0012's "added 2 and removed 1" without loading a text.
- **`drafts` keeps the base as a blob hash**, so the base is shared with the Version that holds the same text.
- **`UnsavedStore<string>` now runs through the main process**, and `flushStorage` and its IPC channel are gone.
