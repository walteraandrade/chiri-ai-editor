# Glossary

Use these names in code, UI, PRs and issues. Avoid synonyms such as "edit", "proposal" or "patch" for a Suggestion.

| Term | Meaning |
|---|---|
| **Document** | The Markdown text in the editor. The only thing the app persists (`localStorage`). |
| **Block** | A top-level node of the CodeMirror Markdown syntax tree: paragraph, heading, list, blockquote, code block. A whole list is one Block. |
| **Target** | The range an AI request is about: the selection, or the Block under the cursor when nothing is selected. |
| **Neighbors** | The 2 Blocks before and the 2 after the Target, plus the document title (first `#`) and the current section heading. Sent as context. |
| **Instruction** | What the user asks for: a Quick action or free text. |
| **Quick action** | A preset Instruction: Shorter, Clearer, More formal, Fix grammar. |
| **Suggestion** | A proposed replacement for a range of the Document. It lives outside the Document (an overlay) until accepted. Holds: range, original text, Replacement, Rationale, refine history. |
| **Replacement** | The new text the AI proposes for a Suggestion's range. |
| **Rationale** | One short sentence from the AI explaining the change, in the Document's language. Shown on hover, or when the cursor is inside the Suggestion. |
| **Active Suggestion** | The most recently created Suggestion, or the one containing the cursor. The only one that shows the Accept / Reject / Refine toolbar. |
| **Accept** | Apply the Replacement to the Document. A normal edit, so `Cmd+Z` undoes it. |
| **Reject** | Drop the Suggestion. Not undoable in v1. |
| **Refine** | A follow-up Instruction on an open Suggestion. Produces a new Replacement in place. The diff is always against the original text. |
| **Discard** | Remove a Suggestion because the user edited inside its range or a newer Suggestion overlapped it. Shows a discreet notice. |
| **Review pass** | On-demand request: the AI reads the whole Document (Blocks numbered `p1`, `p2`, …) and returns up to 6 Suggestions, one per Block, streamed one by one. |
| **Focus** | Optional free text that narrows a Review pass ("focus on tone"). |
| **Draft** | (Backlog) Streamed, not-yet-validated Replacement text shown without a diff. |
| **Bake-off** | Scripted comparison of candidate models on the same requests ([ADR 0010](docs/chiri/adr/0010-model-bakeoff.md)). |
| **AI call record** | Per-call log entry for verification: task, model, provider, tokens, cost, timings, finish reason, generation id. |
| **Gate** | A point where the orchestrator stops for the maintainer's decision. |
