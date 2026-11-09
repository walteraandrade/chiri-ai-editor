# 0008. Stream only where each piece arrives validated

- Status: Accepted (2026-10-28). Amended (2026-10-30): Target requests stream to tell a stalled model from a slow one, from the maintainer's check (45 Blocks → Fix grammar timed out at 30 s).
- Source: planning session, Q24, Q31

## Context

Streaming has three costs here: parsing half-finished JSON, a diff that jitters while text arrives (not-yet-rewritten original text shows as deleted), and showing text before it is validated.

AI SDK v7, verified in its docs on 2026-10-28:
- With `Output.object`, `partialOutputStream` yields partial objects that "cannot be validated against your provided schema". Only the final output is validated.
- With `Output.array`, `elementStream` yields each element "complete and validated against your element schema".

## Decision

- **Review pass:** stream with `Output.array` and `elementStream`. Each Suggestion appears once it is schema-validated by the SDK and checked by the app (`blockId` exists, Replacement differs from the original).
- **Target requests and Refine:** streamed only so the app can tell a stalled model from a slow one ([0007](0007-suggestion-lifecycle.md)). Nothing shows until the whole `Output.object` is validated.
- **Reopen rule:** if the chosen model's median latency for Target requests is above ~3 s, add a Draft preview: streamed text without a diff that turns into the diff once validated.

## Consequences

- The slowest call, the Review pass, shows its first Suggestion early, with no validation trade-off.
- Target requests stay simple: one state, validated before display.
- The Draft preview sits in the backlog behind a measurable rule.

## Alternatives considered

- **No streaming at all:** simplest, but the Review pass waits for all 6 Suggestions.
- **Stream everything, including a Draft for Target requests:** matches the challenge's "live preview" idea, but adds a visual state and a Draft that can fail validation and vanish.
