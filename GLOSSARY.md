# Glossary

Use these names in code, UI, PRs and issues. Avoid synonyms such as "edit", "proposal" or "patch" for a Suggestion.

| Term | Meaning |
|---|---|
| **Document** | The Markdown text in the editor. Persisted to `localStorage` with its History, and to a `.md` file on Save. Open replaces it with a file's text ([ADR 0011](docs/chiri/adr/0011-open-and-save-markdown-files.md)). |
| **Version** | A copy of the whole Document at one moment, with its Cause and time ([ADR 0012](docs/chiri/adr/0012-document-history.md)). Causes: Started, Edited (your edits), Accepted (the Suggestions, with Instruction and Rationale), Opened, Restored. Saved is a mark on a Version. |
| **History** | The Document's Versions, oldest first, kept in `localStorage`. At most 50; the oldest go first. |
| **Timeline** | The bar under the header, one dot per Version. A dot shows that Version against the current text, with Restore. |
| **Full history** | The page "How this Document changed", opened from the Timeline: one entry per Version, newest first, with the lines it changed. |
| **Restore** | Replace the Document with a Version's text. Drops every Suggestion, takes one undo step, and records a Restored Version. |
| **Block** | A top-level node of the CodeMirror Markdown syntax tree: paragraph, heading, list, blockquote, code block. A whole list is one Block. |
| **Target** | The range an AI request is about: the selection, or the Block under the cursor when nothing is selected. |
| **Neighbors** | The 2 Blocks before and the 2 after the Target, plus the document title (first `#`) and the current section heading. Sent as context. |
| **Instruction** | What the user asks for: a Quick action or free text. |
| **Quick action** | A preset Instruction: Shorter, Clearer, More formal, Fix grammar. |
| **Suggestion** | A proposed replacement for a range of the Document. It lives outside the Document (an overlay) until accepted. Holds: range, original text, Replacement, Rationale, refine history. |
| **Replacement** | The new text the AI proposes for a Suggestion's range. |
| **Rationale** | One short sentence from the AI explaining the change, in the Document's language. Shown on hover, or when the cursor is inside the Suggestion; always shown on the Active Suggestion's margin card. |
| **Active Suggestion** | The one containing the cursor; otherwise the most recently asked Suggestion; otherwise the most important open Review pass Suggestion. The only one whose Card has Accept / Reject / Refine. |
| **Card** | The box tied to a Suggestion with its Rationale, plus Accept / Reject / Refine on the Active Suggestion. A margin card sits right of the text, level with the Suggestion's first line, when the window has room; otherwise the Card floats above the Suggestion. While that first line is scrolled away, the Card stays at the top of the screen. For a Suggestion with several Changes, the Active one's Card counts them and its ↑ / ↓ buttons jump between them. |
| **Change** | One place where a Suggestion's Replacement differs from the original: a deletion, an insertion, or both side by side. A Suggestion can hold many; the Card counts them. Not to be confused with the Rationale's "the change", which means the whole Suggestion. |
| **Accept** | Apply the Replacement to the Document. A normal edit, so `Cmd+Z` undoes it. |
| **Reject** | Drop the Suggestion. Not undoable in v1. |
| **Refine** | A follow-up Instruction on an open Suggestion. Produces a new Replacement in place. The diff is always against the original text. Each step (the first request plus each Refine) is kept; the Card's arrows `‹ n / m ›` switch between them. These steps are not Versions: only the accepted one reaches the History. |
| **Discard** | Remove a Suggestion because the user edited inside its range or a newer Suggestion overlapped it. Shows a discreet notice. |
| **Review pass** | On-demand request: the AI reads the whole Document (Blocks numbered `p1`, `p2`, …) and returns up to 6 Suggestions, one per Block, streamed one by one. |
| **Focus** | Optional free text that narrows a Review pass ("focus on tone"). |
| **Draft** | (Backlog) Streamed, not-yet-validated Replacement text shown without a diff. |
| **Bake-off** | Scripted comparison of candidate models on the same requests ([ADR 0010](docs/chiri/adr/0010-model-bakeoff.md)). |
| **AI call record** | Per-call log entry for verification: task, model, provider, tokens, cost, timings, finish reason, generation id. |
| **Gate** | A point where the orchestrator stops for the maintainer's decision. |
