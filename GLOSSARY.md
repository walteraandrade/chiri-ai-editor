# Glossary

Use these names in code, UI, PRs and issues. Avoid synonyms such as "edit", "proposal" or "patch" for a Suggestion.

| Term | Meaning |
|---|---|
| **Document** | The Markdown text in the editor. Persisted to `localStorage` with its History, and to a `.md` file on Save. Open replaces it with a file's text ([ADR 0011](docs/adr/0011-open-and-save-markdown-files.md)). |
| **Version** | A copy of the whole Document at one moment, with its Cause and time ([ADR 0012](docs/adr/0012-document-history.md)). Causes: Started, Edited (your edits), Accepted (the Suggestions, with Instruction and Rationale), Opened, Restored, and External (the file changed outside the app; recorded by the watcher slice). Saved is a mark on a Version. |
| **History** | The Document's Versions, oldest first, read through the async History store. Web build: `localStorage`, one Document, at most 50 (the oldest go first). Electron build: `history.sqlite`, one History per file, no cap ([ADR 0015](docs/adr/0015-history-in-sqlite.md)). |
| **Timeline** | The bar under the header, one dot per Version. A dot shows that Version against the current text, with Restore. |
| **Full history** | The page "How this Document changed", opened from the Timeline: one entry per Version, newest first, with the lines it changed. |
| **Restore** | Replace the Document with a Version's text. Drops every Suggestion, takes one undo step, and records a Restored Version. |
| **Lifecycle** | The open, reload, save and restore of a Document, and what each records in the History, in order: the old text is settled before the key changes, then the new Version is recorded. The History is where it writes, not a synonym. |
| **Block** | A top-level node of the CodeMirror Markdown syntax tree: paragraph, heading, list, blockquote, code block. A whole list is one Block. |
| **Target** | The range an AI request is about: the selection, or the Block under the cursor when nothing is selected. |
| **Neighbors** | The 2 Blocks before and the 2 after the Target, plus the document title (first `#`) and the current section heading. Sent as context. |
| **Instruction** | What the user asks for: a Quick action or free text. |
| **Quick action** | A preset Instruction, picked by typing its name in the bubble's input. On by default: Shorter, Clearer, Fix grammar. Built in but off: More formal, and for skills Make this an instruction and Cut what the agent already knows. The writer turns them on and off, orders them, and adds their own in Preferences. |
| **User Quick action** | A Quick action the writer made: a name and an Instruction, optionally only in skills. Editable and deletable, unlike the built-in ones. |
| **Suggestion** | A proposed replacement for a range of the Document. It lives outside the Document (an overlay) until accepted. Holds: range, original text, Replacement, Rationale, refine history. |
| **Replacement** | The new text the AI proposes for a Suggestion's range. |
| **Rationale** | One short sentence from the AI explaining the change, in the Document's language. Shown on hover, or when the cursor is inside the Suggestion; always shown on the Active Suggestion's margin card. |
| **Active Suggestion** | The one containing the cursor; otherwise the most recently asked Suggestion; otherwise the most important open Review pass Suggestion. The only one whose Card has Accept / Reject / Refine. |
| **Card** | The box tied to a Suggestion with its Rationale, plus Accept / Reject / Refine on the Active Suggestion. A margin card sits right of the text, level with the Suggestion's first line, when the window has room; otherwise the Card floats above the Suggestion. While that first line is scrolled away, the Card stays at the top of the screen. For a Suggestion with several Changes, the Active one's Card counts them and its ↑ / ↓ buttons jump between them. |
| **Change** | One place where a Suggestion's Replacement differs from the original: a deletion, an insertion, or both side by side. A Suggestion can hold many; the Card counts them. Not to be confused with the Rationale's "the change", which means the whole Suggestion. |
| **Accept** | Apply the Replacement to the Document. A normal edit, so `Cmd+Z` undoes it. |
| **Reject** | Drop the Suggestion. Not undoable in v1. |
| **Refine** | A follow-up Instruction on an open Suggestion. Produces a new Replacement in place. The diff is always against the original text. Each step (the first request plus each Refine) is kept; the Card's arrows `‹ n / m ›` switch between them. These steps are not Versions: only the accepted one reaches the History. |
| **AI caret** | The AI's cursor: a bar in the AI color with an "AI" tag showing the Instruction. It shows only while the AI works (a request, a Refine, a Review pass), at the end of the range it is working on. |
| **Discard** | Remove a Suggestion because the user edited inside its range or a newer Suggestion overlapped it. Shows a discreet notice. |
| **Review pass** | On-demand request: the AI reads the whole Document (Blocks numbered `p1`, `p2`, …) and returns up to 6 Suggestions, one per Block, streamed one by one. |
| **Focus** | Optional free text that narrows a Review pass ("focus on tone"). |
| **Draft** | (Backlog) Streamed, not-yet-validated Replacement text shown without a diff. |
| **Skill** | (Backlog) A folder with a `SKILL.md` under a skill root, as agents read it. The Library shows it by its frontmatter `name` ([ADR 0014](docs/adr/0014-skills-on-disk.md)). |
| **Library** | (Backlog) The sidebar listing the skill roots, their Skills and each Skill's files. |
| **Library tree** | The Library as one tree of roots, Skills, folders and files, built from the listing. `evals/` is one folded folder labelled with its Eval count. It follows the WAI-ARIA tree pattern and works from the keyboard alone ([ADR 0020](docs/adr/0020-evals-page-and-foldable-library.md)). |
| **Library rail** | The 40px strip at the left edge that holds the Library and Search buttons. The Library is folded to it at every start and opens beside it, as a column when the window fits it next to the text column and over the page's left edge otherwise. `Ctrl+B` / `Cmd+B` opens and focuses it, focuses it, or folds it, by where the focus is ([ADR 0020](docs/adr/0020-evals-page-and-foldable-library.md)). |
| **Eval** | One test case for a Skill: a folder under the Skill's `evals/` with a `prompt.md` and `graders/`, in the format of `claude plugin eval` ([ADR 0018](docs/adr/0018-skill-evals-through-claude-cli.md)). |
| **Eval run** | One run of all of a Skill's Evals through the Claude CLI, asked for by the user. Each Eval runs in both Arms, 1 to 5 times. |
| **Arm** | One side of an Eval run: with the Skill, or without it; or, against an older Version of `SKILL.md`, today's Skill and the Version (`--ablation none`). Comparing the Arms tells whether the Skill helped. |
| **Stage** | The temporary copy of a Skill an Eval run works on, without the folders that load code (`hooks/` and others). Deleted when the run ends. |
| **Library search** | The field at the top of the open Library, reached with `Ctrl+P` / `Cmd+P` or the rail's Search button. It suggests Skills and files as the writer types, by Skill name, then a word in it, then file path, then description, at most 12, the match underlined; `Enter` opens the row (a Skill opens its `SKILL.md`). If it unfolded the Library, opening a result folds it again. It does not search inside files ([ADR 0020](docs/adr/0020-evals-page-and-foldable-library.md)). |
| **Evals page** | The page "How this Skill performs", in the main column like Full history. It shows a Skill's last complete run and starts the next. Opened from the Evals button, shown only for a file in a Library Skill ([ADR 0020](docs/adr/0020-evals-page-and-foldable-library.md)). |
| **Suspicious case** | An Eval whose result says little: it passes in both Arms, fails in both, or its runs disagree. Flagged on the Evals page, still counted. |
| **External change** | (Backlog) A change to a file made outside the app (an agent, another editor, `git pull`). Recorded as an External Version. The External change notice offers "Reload from disk" or "Keep mine"; Save shows it when the disk no longer holds the text last read or written. |
| **Web build** | (Backlog) The browser app: a tab on the Vite dev server, `pnpm dev`. Gets shared code, no new platform features ([ADR 0016](docs/adr/0016-web-and-electron-builds.md)). |
| **Electron build** | (Backlog) The native app: an Electron window, `pnpm dev:electron` ([ADR 0013](docs/adr/0013-native-app-on-electron.md)). The Library, the watcher and `history.sqlite` exist only here. |
| **Bake-off** | Scripted comparison of candidate models on the same requests ([ADR 0010](docs/adr/0010-model-bakeoff.md)). |
| **AI call record** | Per-call log entry in `window.__aiCalls`, dev only: task, model, provider, tokens, cost, timings, finish reason, generation id. |
| **Theme** | The colors the app paints with: 12 solid roles and a fixed mode, light or dark. Picked in Preferences. |
| **Palette** | A Theme from the book: 2 Vol. 1 combinations of *A Dictionary of Color Combinations* that share a color, at least 6 colors, named after a Duke Ellington composition ([ADR 0017](docs/adr/0017-book-themes-and-solid-colors.md)). |
| **Preferences** | The screen for app settings: themes and Quick actions. Opens with `Ctrl+,`, a button in the Web build, and `File > Preferences…` in the Electron build. |
