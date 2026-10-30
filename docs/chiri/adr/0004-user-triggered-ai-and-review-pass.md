# 0004. User-triggered AI, plus an on-demand Review pass

- Status: Accepted (2026-10-28). Amended (2026-10-29): where the cursor goes when a pass ends, from the maintainer's check ([PR #20](https://github.com/walteraandrade/chiri-ai-editor/pull/20)). Amended (2026-10-30): the selection bubble stays on screen for a long selection, from the maintainer's check.
- Source: planning session, Q5, Q12, Q28

## Context

"The user is always in control", but the AI should feel like a co-author, not something that completes the whole Document.

## Decision

- **The AI acts only when asked.**
- **Selection bubble:** Quick actions (Shorter, Clearer, More formal, Fix grammar) plus a free-text "Ask AI…" field. `Cmd/Ctrl+K` opens the same field. With no selection, the Target is the Block under the cursor. The bubble sits at the end of the selection where the cursor is. When that end is off screen but part of the selection is on screen (`Ctrl+A`, say), it sits at the nearest screen edge.
- **Review pass:** a toolbar button with an optional Focus. Without Focus, the AI looks at clarity, concision, grammar and tone consistency. It returns at most 6 Suggestions, most important first. It skips code blocks and Blocks that already have an open Suggestion. When the pass ends (done, stopped or failed) and the focus is not in the text or one of its Cards, the cursor goes to the start of the open review Suggestion closest to the top, which makes it the Active Suggestion, and the page scrolls to it. If the user is working in the text, nothing moves.
- **No slash commands, no proactive hints.**
- Many Suggestions can be open at once from day one.

## Consequences

- Predictable, cheap, and the user is in control.
- The Review pass gives the "colleague marking up my draft" feeling without ambient noise.
- The 6-Suggestion cap leaves issues untouched in long, rough Documents. A wall of red and green would read as "the AI rewrote everything".

## Alternatives considered

- **Proactive hints on idle:** the strongest co-author feel, but it burns tokens under a US$5 cap, is noisy, and is hard to tune.
- **Slash commands:** they pull toward "generate at cursor", which is close to completing the Document.
- **Free-text only, no Quick actions:** less discoverable. Reviewers would have to invent what to ask.
