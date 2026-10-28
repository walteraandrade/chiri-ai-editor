# 0004. User-triggered AI, plus an on-demand Review pass

- Status: Accepted (2026-10-28)
- Source: planning session, Q5, Q12, Q28

## Context

"The user is always in control", but the AI should feel like a co-author, not something that completes the whole Document.

## Decision

- **The AI acts only when asked.**
- **Selection bubble:** Quick actions (Shorter, Clearer, More formal, Fix grammar) plus a free-text "Ask AI…" field. `Cmd/Ctrl+K` opens the same field. With no selection, the Target is the Block under the cursor.
- **Review pass:** a toolbar button with an optional Focus. Without Focus, the AI looks at clarity, concision, grammar and tone consistency. It returns at most 6 Suggestions, most important first. It skips code blocks and Blocks that already have an open Suggestion.
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
