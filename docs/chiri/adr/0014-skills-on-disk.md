# 0014. Skills on disk are the source of truth

- Status: Accepted (2026-10-31); Electron build only, except the frontmatter rule, which is shared code ([0016](0016-web-and-electron-builds.md)). Watcher and write details added on 2026-11-01; Save check, unsaved text and request rules added by the file slice (#30); watcher built in #33 (notes marked #33)
- Source: maintainer request (native skills editor). The maintainer proposed Convex as the database; the review kept the files on disk as the only copy, and the maintainer chose local only.

## Context

Claude Code reads a skill from `<root>/<name>/SKILL.md`, plus the files beside it. Other agents share some of these folders. On the maintainer's machine, `~/.claude/skills` has 32 entries; many are symlinks into `~/.agents/skills`, and one points inside a cloned repo. They hold 343 files, 111 of them Markdown (median 6.9 KB, p90 20 KB, max 60 KB). Claude Code, other editors and `git pull` change them without the app.

## Decision

- **The disk holds the only copy of a skill.** The app keeps no second copy of the text, apart from History ([0015](0015-history-in-sqlite.md)) and the unsaved text of the open file.
- **Library:** the skill roots the app lists. Defaults: `~/.claude/skills` and `~/.agents/skills`. The maintainer adds project roots (`<repo>/.claude/skills`). Plugin skills are not listed: the plugin manager replaces them on update.
  - The project roots are kept in `library-roots.json` in the app's user data folder. If that file cannot be read, the Library says so and lists only the defaults, and Add and Remove refuse to write, so a damaged file is never replaced by a list that forgot its roots.
- **Skill:** a folder under a root with a `SKILL.md`. The Library shows it by the frontmatter `name`, with its `description`, and lists the folder's files under it.
- **Identity is the real path.** A skill reached through a symlink and through its target shows once. Every read, write and History key uses `realpath`.
- **Editable files:** Markdown (`.md`) only. Other files are listed, not opened.
- **Still one Document.** Opening a file replaces the Document as [0011](0011-open-and-save-markdown-files.md) describes. With unsaved text, it first asks Save, Discard or Cancel. Tabs are in the backlog.
  - A Document with no file counts as having unsaved text when it differs from the sample Document, so a draft restored at start counts too; Save then asks for a file (Save as). While it still equals the sample, it is replaced with no question.
  - The question comes after the file is picked or read, so a cancelled dialog or an unreadable file costs nothing. If the answer is Save and the file to open is the one just written, it is read again, so the editor never gets the text from before the Save.
- **Save stays explicit.** A save is seen by every agent at once, so the app writes only when told to.
- **Save never overwrites a change it has not seen.** Before writing, the main process compares the disk text with the text last read or written. If they differ, Save stops and shows the External change notice.
  - The renderer sends that text with every Save (the session's saved text), so the main process keeps no per-file state. Both texts are compared after decoding (no byte order mark, LF line endings). A file that is gone, or no longer valid UTF-8 text, counts as a change.
  - The check runs again right before the rename, after the temporary file is written and synced, so a write by an agent during that time is seen too. A temporary file that loses the check is removed.
  - "Keep mine" never forces a write: the next Save asks again. The ways out are "Reload from disk" and Save as.
- **Writes are atomic:** write a temporary file next to the real path (a symlink's target), give it the old file's mode, then rename it. An agent never reads half a file, a symlink stays a symlink, and permissions stay as they were.
- **External change:** the watcher reports a change to the open file.
  - With no unsaved text, the Document reloads and History records an External Version.
  - With unsaved text, a notice offers "Reload from disk" or "Keep mine". Keep mine leaves the dot on; the next Save asks again.
  - #33 · The main process only tells the renderer which paths changed (`{ paths, library }`, one push channel, `onExternalChanges`) and which file is open (`watchFile`). The renderer decides, because it holds the session's saved text and the Document: it reads the file, then compares the disk text with what is being written (an own write in flight), with the saved text (an own write done, or a touch) and with the disk text the user already answered (Keep mine). A file that is gone or no longer valid UTF-8 shows the notice, clean or not.
  - #33 · A clean reload keeps the cursor and the scroll: the editor gets the smallest change between the old and the new text, not the whole text. Pending Suggestions are dropped, as on Open. "Reload from disk" records an External Version too, because the text came from outside; the unsaved text it replaces is recorded as an Edited Version first.
- **What the watcher watches:**
  - Folders, not files. A rename (the app's own Save, `git pull`, most editors) gives the path a new inode, and a watch on the old file goes quiet.
  - Real paths. A root's symlinks can point outside every root (one points into a cloned repo), and a watch on the root does not see changes there.
  - Not its own writes. A change whose disk text equals the text last written by the app is not an External change.
  - #33 · Node's `fs.watch` on directories, not recursive (inotify on Linux), no dependency. Electron 43 ships Node 24.22.1. Node's docs say a watch follows the inode: a deleted and recreated folder is a new inode, and the old watch emits one event and then goes quiet (checked on this machine too). So each watch is keyed by the folder's `dev:ino`, and a folder whose identity changed gets a new watch at the next scan.
  - #33 · What is watched, from the last scan of the roots: each root's real path; every folder under a root, **a skill or not**, and every link in a root that points at a folder, with the real folder it points to and the folder that holds that (a skill is usually born as a `mkdir` and gets its `SKILL.md` later, and a link can point at a folder that is still empty); the real folder of every file the scan lists, which covers a file symlinked from elsewhere; the open file's folder, even outside every root. For a link in a root whose target is gone, and for a root that does not exist, the nearest existing parent of the missing path is watched, so the skill or the root coming back is seen. A watch that cannot be opened (the inotify limit) is logged and tried again at the next scan.
  - #33 · After a scan opens new watches, the scan runs once more, because a change between the first scan and the new watch would otherwise be lost. If the two listings differ, the renderer is told to read the Library again and the watches are planned once more.
  - #33 · Events are batched: 250 ms after the last one, at most 1 s after the first. Hidden names (`.name`, which covers the temporary file of an atomic write) and `node_modules` are ignored, with two exceptions: the open file itself, and the name a missing path is waiting for in a watched parent (`.agents` in `~` while `~/.agents/skills` does not exist; `.store` for a link target `/work/.store/shared`). A rename, a `SKILL.md` or an unknown name tells the Library to scan again; a plain write to another file only reports its path. The Library does not redraw when the new listing equals the old one.
  - #33 · `watchFile` asks can finish out of order (the real path of the first is resolved after the second's). The latest ask wins; a late answer is dropped.
- **Unsaved text survives a crash:** it is kept per file, debounced like today's autosave, and offered when that file opens again.
  - It keeps the text the edits started from. After a restart, the file's saved text is that one, not the disk text, so a file changed while the app was closed ends in the External change notice instead of being overwritten.
  - The last file reopens at start, before the first render, with its unsaved text. If it is gone (not found), the app says so once and forgets it; the text stays in the Document, and the per-file entry is dropped only once the Document holds it.
  - It lives in the `drafts` table of `history.sqlite` ([0015](0015-history-in-sqlite.md)), keyed by real path, so a killed process keeps it. (The first File slice kept it in the renderer's `localStorage` and asked the main process to flush that storage after each change; #31 moved it.)
- **Requests are validated in the main process:** absolute paths with no NUL, strict fields, size limits; only `.md` and `.markdown` files, checked on the resolved path; text must be valid UTF-8; files over 5 MiB are refused, and so is a Save whose UTF-8 bytes are over 5 MiB (the text limit on the request counts characters, so the byte check is the one that bites).
- **Save as never replaces a file the dialog did not ask about.** The dialog's overwrite confirmation sees the name the user typed. If adding `.md` gives a path that already exists, Save as stops with "notes.md already exists".
- **Frontmatter is not a Block.** `@codemirror/lang-markdown` reads a `---` frontmatter as a rule plus a level-2 heading, so a Review pass could rewrite the YAML. Block extraction skips a frontmatter at the start of the Document, and Targets inside it are refused.

## Consequences

- Claude Code sees every Save at once, with no sync step.
- The app has to handle changes it did not make. The watcher and the check before Save are part of the core, not polish.
- Two machines do not share History or unsaved text. Files move between machines the way they do today (git, dotfiles).
- The browser's `chiri.document` and `chiri.history` do not reach Electron: another browser profile (and, installed, another origin). Nothing migrates.

## Alternatives considered

- **Convex:** reactive and synced across devices, but a second copy of every skill that must be kept in step with the disk both ways, conflicts when an agent edits the file, a network and an account (or a self-hosted backend in Docker), and no gain for one user on one machine.
- **App-owned store, export to disk:** a clean data model, but Claude Code only sees the export, and edits made by agents are lost or conflict.
- **git as the store:** history for free, but commits into clones the maintainer does not own, and an Instruction or Rationale fits poorly in a commit.
