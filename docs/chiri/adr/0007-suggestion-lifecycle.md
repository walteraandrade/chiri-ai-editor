# 0007. Suggestion lifecycle

- Status: Accepted (2026-10-28). Amended (2026-10-28): the toolbar became a margin card, from the backlog. Amended (2026-10-29): Refine version arrows, from the backlog ([#18](https://github.com/walteraandrade/chiri-ai-editor/issues/18)). Amended (2026-10-30): files ([0011](0011-open-and-save-markdown-files.md)).
- Source: planning session, Q13, Q19, Q20, Q21, Q22, Q25, Q32

## Context

Suggestions are overlays ([0001](0001-inline-overlay-suggestions.md)) and the user keeps typing while they are open or in flight.

## Decision

- **Edits outside a Suggestion:** its range is mapped through the change (CodeMirror `ChangeSet` mapping).
- **Edits inside an open Suggestion, or inside an in-flight request's Target:** Discard it, with a discreet notice ("Suggestion discarded: the text changed").
- **Overlaps:** a new request over an open Suggestion replaces it, so the last one wins. The Review pass skips Blocks with open Suggestions.
- **Active Suggestion:** shows the Accept / Reject / Refine card. When the window has room right of the text, the card sits in that margin, level with the Suggestion's first line, and always shows the Rationale: it covers no text, and a card that grew on hover would move its buttons away from the pointer. Otherwise it floats above the Suggestion, and its Rationale shows on hover and when the text cursor is inside it (keyboard users can't hover). Other Suggestions show only the inline diff; on hover, their Rationale shows in a card without buttons, in the same place.
- **Keys, with the cursor inside a Suggestion:** `Cmd/Ctrl+Enter` Accepts, `Esc` Rejects. Accept is a normal edit, so `Cmd+Z` undoes it. Reject is not undoable in v1. A Review pass also offers Accept all and Reject all.
- **Refine:** a follow-up Instruction on the Active Suggestion. The new Replacement replaces the old one in place. The diff is always against the original text. History stays in memory.
- **Versions:** once a Suggestion has 2 or more steps (the first request plus each Refine), its Card shows `‹ n / m ›` with the shown step's Instruction. The arrows switch the shown Replacement, its Rationale and the inline diff; Accept applies the shown version. The original text is not a version: Reject covers it. A Refine from an earlier version sends only the Instructions up to it, with its Replacement as the latest; on success the later steps are dropped and the new one is appended, like typing after an undo. A failed or cancelled Refine drops nothing; stepping to another version dismisses a failed Refine's error, so Retry always repeats the same request. The arrows are disabled while a Refine is in flight. With the cursor inside such a Suggestion, or the focus on its Card's buttons, `Ctrl+H` / `Ctrl+L` show the previous / next version (`Ctrl` on macOS too, since `Cmd+H` hides the app). In the Refine box they keep their usual text meaning. They are free in CodeMirror outside macOS, and the browser's History and address bar keys are kept away only there; on macOS they replace delete-backward (an edit inside the Suggestion, which would discard it) and select-line. `Alt-ArrowLeft` / `Alt-ArrowRight` and `Mod-[` / `Mod-]` stay with CodeMirror (word or syntax jumps, indentation), and `Ctrl+Alt+arrows` is often taken by the desktop or VoiceOver.
- **Persistence:** only the Document text goes to `localStorage`, and to a file on Save ([0011](0011-open-and-save-markdown-files.md)). Open Suggestions are lost on reload, and when a file is opened.
- **Failures:**
  - Missing key: banner ([0005](0005-local-only-vite-proxy.md)).
  - Failed call (network, `402` out of credit, `429`): the Suggestion becomes an error card with Retry. `402` gets its own message.
  - Invalid output: one silent retry, then the error card.
  - Timeout: 30 s.

## Consequences

- Simple, honest rules. A user who bumps into a Suggestion loses it, and can ask again.
- An accidental `Esc` loses a Suggestion. An undoable Reject is in the backlog.

## Alternatives considered

- **Keep a stale Suggestion with "regenerate":** an extra state, and an old diff can't be drawn over changed text.
- **Lock the range while a Suggestion is open:** takes control away from the user.
- **Block new requests until the old Suggestion is resolved:** friction.
- **Allow overlapping Suggestions:** accepting one breaks the other.
- **Rationale always visible, or in a side panel:** the side panel drifts toward the chatbot sidebar.
