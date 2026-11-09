# 0001. Inline Suggestions as an overlay on a raw-Markdown CodeMirror editor

- Status: Accepted (2026-10-28)
- Source: planning session, Q1, Q2, Q9

## Context

The challenge asks for visible diffs before the user accepts, and for an experience that feels like a co-author, "not a chatbot in a sidebar". We had to choose where Suggestions appear and what kind of editor holds the text.

## Decision

- **Editor:** CodeMirror 6 showing raw Markdown with light styling, Obsidian-like: bigger headings, bold looks bold, syntax marks stay visible.
- **Suggestions inline, as tracked changes:** deleted text is struck through in place and the Replacement shows next to it, rendered with CodeMirror decorations and widgets.
- **Overlay, not content:** Suggestions live in editor state outside the Document. The Document only ever holds the user's text. Accept applies the Replacement as a normal edit. Reject drops the Suggestion.

## Consequences

- The Document is a plain string, so diffs are plain string diffs: simple and reliable.
- Copying, saving and persisting never leak Suggestion markup.
- The Replacement is not directly editable. Users Refine it, or Accept and then edit.
- Less "Google Docs" polish than a WYSIWYG editor.

## Alternatives considered

- **Split pane before/after:** easier, but the eye jumps between two places and it feels like a tool, not a partner.
- **Chat sidebar producing patches:** what the challenge says to avoid.
- **Tiptap / ProseMirror WYSIWYG:** the Markdown round-trip is lossy, and tracked changes over a node tree are notoriously hard.
- **Suggestion text inserted into the Document with marks:** the Markdown stays dirty while Suggestions are open, and Reject needs careful undo.
