# 0002. Structured model output; the app owns the anchors

- Status: Accepted (2026-10-28)
- Source: planning session, Q10, Q39

## Context

What can go wrong with a model's answer here:

| Failure | Plain text | Structured JSON |
|---|---|---|
| Wrapper chatter ("Sure! Here's…", code fences) | happens, needs cleaning | gone, the schema enforces the shape |
| Changes beyond the Instruction | happens | happens equally |
| Invented content | happens | happens equally |
| Wrong location (quotes text that doesn't exist) | impossible, the app knows the range | **new risk**, if the model picks the location |

The diff itself guards against rows 2 and 3: every change is visible before Accept. Structure removes row 1 and makes the answer checkable, but can create row 4.

## Decision

- **Strict structured outputs:** `structured_outputs` with OpenRouter `provider.require_parameters: true`, so only providers that support it are used. One zod schema per shape is both the validator and the source of the JSON Schema.
- **Target requests and Refine:** the app already knows the range. The model returns `{ replacement, rationale }`.
- **Review pass:** the app numbers Blocks (`p1`, `p2`, …) before sending. The model returns `{ edits: [{ blockId, replacement, rationale }] }` and never copies text to say where. A Block is a top-level node of the Markdown syntax tree; a whole list is one Block.
- **App-side validation:** drop an item when `replacement` equals the original or `blockId` is unknown. On invalid output, retry once silently, then show an error card.

## Consequences

- No chatter, a Rationale for every change, and answers the app can check.
- Review pass granularity is one Block: two changes in one paragraph become one Suggestion, and a long list is a single Suggestion.
- Format constraints may slightly lower writing quality ("Let Me Speak Freely?", 2024). The Bake-off watches for it ([0010](0010-model-bakeoff.md)).

## Alternatives considered

- **Plain-text Replacement for Target requests:** simplest, but no Rationale and no validation.
- **Quote-anchored edits `{ quote, replacement }` everywhere:** uniform, but a one-character slip in `quote` drops the edit, even where the app already knew the range.
- **Character offsets:** models are bad at counting characters.
- **Blank-line splitting for Blocks:** breaks on lists without blank lines and on code blocks that contain empty lines.
