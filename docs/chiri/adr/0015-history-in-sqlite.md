# 0015. History in SQLite

- Status: Accepted (2026-10-31); Electron build only, while the Web build keeps 0012's `localStorage` behind the same async History store ([0016](0016-web-and-electron-builds.md)). Amended by the first History slice (#31): driver, and the notes marked "#31" below
- Source: maintainer request: History must not be capped by a browser quota now that the app is native and lives longer. Turso, JSONL files, git and Convex were weighed; the maintainer chose local only.
- Amends: [0012](0012-document-history.md) (storage, cap, one Document), in the Electron build

## Context

[0012](0012-document-history.md) keeps one Document's History in `localStorage`: at most 50 Versions, the whole array rewritten on every change, and 10, 1 or 0 Versions when the quota refuses the write. A skills editor has a History per file and runs for months. One 20 KB file with 1,000 Versions is about 20 MB of raw text.

## Decision

- **One SQLite file**, `history.sqlite` in Electron's `userData` folder, opened by the main process only. The renderer reads and writes it through the preload API ([0013](0013-native-app-on-electron.md)).
- **Schema:**

  ```sql
  create table files (
    id integer primary key,
    path text unique not null
  );
  create table blobs (
    hash text primary key,
    body blob not null
  );
  create table versions (
    id integer primary key,
    file_id integer not null references files(id),
    at integer not null,
    cause text not null,
    blob_hash text not null references blobs(hash),
    words integer not null,
    words_added integer not null,
    words_removed integer not null,
    saved text
  );
  create index versions_by_file on versions(file_id, at);
  create table drafts (
    file_id integer primary key references files(id),
    text text not null,
    at integer not null
  );
  ```

  - `path` is the real path ([0014](0014-skills-on-disk.md)).
  - `body` is the whole text, gzipped. Equal texts share one blob by SHA-256.
  - `cause` is the 0012 Cause as JSON, plus a new one: External (the file changed on disk).
  - `words` is counted on insert, so the Timeline never loads a text.
  - `words_added` and `words_removed` (#31) are counted on insert too, against the previous Version of the same file (against an empty text for the first one). They keep [0012](0012-document-history.md)'s Edited headline ("You added 2 words and removed 1") without loading a text in the Timeline, which a net change in `words` could not.
  - `drafts` holds the open file's unsaved text.
- **Appends, not rewrites.** The recorder emits "Version recorded" and "Version marked saved". Each one is one transaction.
- **Text on demand.** The Timeline lists Versions without their text and loads a text when a dot is viewed (a Virtual Proxy). The Full history loads the texts of the entries on screen, plus the Version before each one, for its line diff.
- **No cap.** A rule that thins out old Edited Versions is in the backlog, for when the file grows.
- **WAL mode.** Pending edits still become a Version after 30 s idle, before any other Version, on Save, on switching files, and on window close.
- **Portable SQL:** plain SQLite types, no extensions. libSQL and Turso read the same file format, so a later move to sync stays cheap.
- **Driver: `node:sqlite`** (picked in #31). Checked in the real runtime, not only in Node 22: Electron 43.8.6 ships Node 24.22.1 and SQLite 3.53.4, `require('node:sqlite')` exposes `DatabaseSync`, `StatementSync`, `Session`, `constants` and `backup`, `pragma journal_mode = wal` answers `wal`, and a gzipped `Buffer` binds as a BLOB and reads back as a `Uint8Array`. Node 24's docs rate the module Stability 1.2 (release candidate). So there is no native module to rebuild for Electron's ABI and nothing to unpack from the `asar`. The unit tests run the same API on Node 22.22, which prints an `ExperimentalWarning`. electron-vite leaves `node:sqlite` as an external import in `out/main/index.js`.
  - #31 · One connection, opened by the main process on the first History call and closed on `will-quit`. `pragma journal_mode = wal`, `synchronous = normal` and a 5 s `busy_timeout`; `user_version` 1, and a database with a newer version is refused.
  - #31 · Each recorder event is one `begin immediate` transaction: the blob insert (`insert or ignore`), the Version insert and, for "Version marked saved", the mark.
  - #31 · The first Version of a file is always Started. A text equal to the file's last Version is not recorded (compared by SHA-256, as in 0012). "Version marked saved" marks the newest Version holding the text, and records an Edited one first when none does.
  - #31 · Versions are ordered by `id`, not by `at`, so a clock that goes backwards cannot reorder them. `versions.id` is global to the database; the Web adapter numbers its one History from 1.
  - #31 · `words_added` and `words_removed` come from the same word diff 0012 ran at render time (`wordDelta`: a line diff, then a word diff of each changed run, with an edit-distance cap), run once on insert against the Version before it. A restored old text is counted against the last Version, not against its source. The Web adapter stores the same two counts on each Version in `localStorage`; Versions stored before #31 have none, and the adapter works them out from the Version before (the first one from an empty text).
  - #31 · The preload API calls the `drafts` table "unsaved" (`unsavedLoad`, `unsavedSave`, `unsavedClear`), because the Glossary's Draft is the streamed Replacement text.
  - #31 · If the database cannot be opened, the Electron window shows "Chiri could not start: …" instead of a blank page.

## Consequences

- History outlives the window, the browser quota and the 50-Version cap.
- The main process owns History, so the watcher can record External Versions with no window open on that file.
- The Timeline and Full history move from an in-memory array to async reads, in both builds. That is the largest change in the History code.
- `userData` is one more folder to back up. Deleting `history.sqlite` resets History and never touches a skill.

## Alternatives considered

- **`localStorage` or IndexedDB in the renderer:** no native code, but a quota or async code in the renderer, and the main process cannot write to it when the watcher sees a change.
- **One JSONL file per skill file:** no native module, cheap appends, readable by hand. But thinning rewrites the file, and a query across files reads every file.
- **git:** diff and blame for free, but commits in clones the maintainer does not own, a commit per idle pause, and Instruction and Rationale squeezed into commit messages.
- **Turso:** the same file format. The engine (a Rust rewrite of SQLite) is pre-1.0 and in beta, and its sync, the real gain, is not wanted: local only. Its own page still lists conflict resolution as "Soon".
- **Convex:** see [0014](0014-skills-on-disk.md).
- **`better-sqlite3` (driver):** the usual choice before Node had SQLite built in. But it is a native module: rebuilt against Electron's ABI on every Electron bump, and unpacked from the `asar`. Not needed while `node:sqlite` works in the shipped Electron. It stays the fallback if a later Electron drops the module.
- **Diffs instead of whole texts:** smaller, but Restore needs a replay, and one bad step breaks every Version after it (as 0012 found). Gzip plus shared blobs covers the size.
