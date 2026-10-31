# 0014. Skills on disk are the source of truth

- Status: Accepted (2026-10-31)
- Source: maintainer request (native skills editor). The maintainer proposed Convex as the database; the review kept the files on disk as the only copy, and the maintainer chose local only.

## Context

Claude Code reads a skill from `<root>/<name>/SKILL.md`, plus the files beside it. Other agents share some of these folders. On the maintainer's machine, `~/.claude/skills` has 32 entries; many are symlinks into `~/.agents/skills`, and one points inside a cloned repo. They hold 343 files, 111 of them Markdown (median 6.9 KB, p90 20 KB, max 60 KB). Claude Code, other editors and `git pull` change them without the app.

## Decision

- **The disk holds the only copy of a skill.** The app keeps no second copy of the text, apart from History ([0015](0015-history-in-sqlite.md)) and the unsaved text of the open file.
- **Library:** the skill roots the app lists. Defaults: `~/.claude/skills` and `~/.agents/skills`. The maintainer adds project roots (`<repo>/.claude/skills`). Plugin skills are not listed: the plugin manager replaces them on update.
- **Skill:** a folder under a root with a `SKILL.md`. The Library shows it by the frontmatter `name`, with its `description`, and lists the folder's files under it.
- **Identity is the real path.** A skill reached through a symlink and through its target shows once. Every read, write and History key uses `realpath`.
- **Editable files:** Markdown (`.md`) only. Other files are listed, not opened.
- **Still one Document.** Opening a file replaces the Document as [0011](0011-open-and-save-markdown-files.md) describes. With unsaved text, it first asks Save, Discard or Cancel. Tabs are in the backlog.
- **Save stays explicit.** A save is seen by every agent at once, so the app writes only when told to.
- **Save never overwrites a change it has not seen.** Before writing, the main process compares the disk text with the text last read or written. If they differ, Save stops and shows the External change notice.
- **Writes are atomic:** write a temporary file next to the real path, then rename it. An agent never reads half a file, and a symlink stays a symlink.
- **External change:** the watcher reports a change to the open file.
  - With no unsaved text, the Document reloads and History records an External Version.
  - With unsaved text, a notice offers "Reload from disk" or "Keep mine". Keep mine leaves the dot on; the next Save asks again.
- **Unsaved text survives a crash:** it is kept per file, debounced like today's autosave, and offered when that file opens again.
- **Frontmatter is not a Block.** `@codemirror/lang-markdown` reads a `---` frontmatter as a rule plus a level-2 heading, so a Review pass could rewrite the YAML. Block extraction skips a frontmatter at the start of the Document, and Targets inside it are refused.

## Consequences

- Claude Code sees every Save at once, with no sync step.
- The app has to handle changes it did not make. The watcher and the check before Save are part of the core, not polish.
- Two machines do not share History or unsaved text. Files move between machines the way they do today (git, dotfiles).
- The browser's `chiri.document` and `chiri.history` do not reach Electron: another origin. Nothing migrates.

## Alternatives considered

- **Convex:** reactive and synced across devices, but a second copy of every skill that must be kept in step with the disk both ways, conflicts when an agent edits the file, a network and an account (or a self-hosted backend in Docker), and no gain for one user on one machine.
- **App-owned store, export to disk:** a clean data model, but Claude Code only sees the export, and edits made by agents are lost or conflict.
- **git as the store:** history for free, but commits into clones the maintainer does not own, and an Instruction or Rationale fits poorly in a commit.
