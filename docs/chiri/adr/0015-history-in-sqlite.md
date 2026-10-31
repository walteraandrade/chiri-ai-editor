# 0015. History in SQLite

- Status: Accepted (2026-10-31)
- Source: maintainer request: History must not be capped by a browser quota now that the app is native and lives longer. Turso, JSONL files, git and Convex were weighed; the maintainer chose local only.
- Amends: [0012](0012-document-history.md) (storage, cap, one Document)

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
  - `drafts` holds the open file's unsaved text.
- **Appends, not rewrites.** The recorder emits "Version recorded" and "Version marked saved". Each one is one transaction.
- **Text on demand.** The Timeline lists Versions without their text and loads a text when a dot is viewed (a Virtual Proxy). The Full history loads the texts of the entries on screen, plus the Version before each one, for its line diff.
- **No cap.** A rule that thins out old Edited Versions is in the backlog, for when the file grows.
- **WAL mode.** Pending edits still become a Version after 30 s idle, before any other Version, on Save, on switching files, and on window close.
- **Portable SQL:** plain SQLite types, no extensions. libSQL and Turso read the same file format, so a later move to sync stays cheap.
- **Driver:** `node:sqlite` if the Electron build exposes it, otherwise `better-sqlite3`, rebuilt for Electron and unpacked from the `asar`. The History slice picks one and amends this ADR.

## Consequences

- History outlives the window, the browser quota and the 50-Version cap.
- The main process owns History, so the watcher can record External Versions with no window open on that file.
- The Timeline and Full history move from an in-memory array to async reads. That is the largest change in the History code.
- `userData` is one more folder to back up. Deleting `history.sqlite` resets History and never touches a skill.

## Alternatives considered

- **`localStorage` or IndexedDB in the renderer:** no native code, but a quota or async code in the renderer, and the main process cannot write to it when the watcher sees a change.
- **One JSONL file per skill file:** no native module, cheap appends, readable by hand. But thinning rewrites the file, and a query across files reads every file.
- **git:** diff and blame for free, but commits in clones the maintainer does not own, a commit per idle pause, and Instruction and Rationale squeezed into commit messages.
- **Turso:** the same file format. The engine (a Rust rewrite of SQLite) is pre-1.0 and in beta, and its sync, the real gain, is not wanted: local only. Its own page still lists conflict resolution as "Soon".
- **Convex:** see [0014](0014-skills-on-disk.md).
- **Diffs instead of whole texts:** smaller, but Restore needs a replay, and one bad step breaks every Version after it (as 0012 found). Gzip plus shared blobs covers the size.
