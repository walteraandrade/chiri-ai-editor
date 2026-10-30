# PR #24 verification: long Targets, error Toast, bubble on screen

[PR #24](https://github.com/walteraandrade/chiri-ai-editor/pull/24). No issue: the maintainer hit it on 2026-10-30. `select p1–p45 → Fix grammar` failed with "The model took too long to answer" after 30003 ms (their `window.__aiCalls`: no usage, no generation id), and the error card sat after the last Block, off screen. Checked on 2026-10-30 in a real browser (`agent-browser`, headless Chrome, 1440 x 900) against `pnpm dev` on this branch, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on a generated 46-Block Document (3239 words, 17620 characters, with grammar errors on purpose).

## Cause

- Target requests used `generateText` with 30 s in all. Nothing arrives until the whole Replacement is written, and `gpt-6.1-terra` writes about 85 tokens/s (3808 tokens in 44.9 s below), so a Target needing more than about 2300 output tokens timed out while the model was still writing. The timeout was ours, not OpenRouter's.
- `maxOutputTokens` for a Target was 4096. This check used 3808, so a slightly longer Target would have been cut (`length`), failed as invalid output, and been retried once at the same cost.
- The error card is a block widget at the end of the Target, so for a long Target it is far from where the user is.
- The selection bubble sits at the end of the selection where the cursor is, so after `Ctrl+A` it was at the end of the Document, off screen.
- After the fix, the maintainer's Fix grammar on their whole Document (`SKILL.md`, 122 lines) "did nothing": it returned one Suggestion with 3 small changes (lines 39, 56 and 74), none on screen, and nothing said how many there were or where. The Card sat level with line 1.

## Change

```text
runTargetAttempt (Target requests and Refine)
  streamText + Output.object          # nothing shows until the whole object is validated (ADR 0008)
  timeout: firstChunkMs 30 s, chunkMs 15 s, totalMs 10 min shared with the silent retry
  maxOutputTokens: max(4096, 0.75 × Target characters), at most 32768
Review pass: unchanged (30 s in all)

update listener: newlyFailed(before, after) → Toast "<describeError>" [Retry] [Show]
  Retry: same as the card's Retry
  Show:  scroll the error card to the center

selection bubble and Cards getCoords → inViewCoords → keepInBand(anchor, range, visible band)
  anchor off screen and part of the range on screen → nearest screen edge

Active Suggestion Card, when showsChanges (2+ changes, or more than one line)
  "3 changes" / "Change 2 of 3"     changeLabel(changeRanges(suggestion), cursor), the cursor anywhere in a change
  [↑] [↓] buttons                   stepChange: cursor to the start of the previous / next change, scrolled to the center, wrapping
```

ADRs [0004](../adr/0004-user-triggered-ai-and-review-pass.md) (bubble on screen), [0007](../adr/0007-suggestion-lifecycle.md) (timeout, error Toast, change count, Card on screen) and [0008](../adr/0008-validated-streaming-only.md) (Target requests stream) are amended.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `src/ai/client.test.ts`: output token limit (base for a short Target, grows with a long one, stops at 32768); stall timeout (keeps waiting while the model writes past both stall limits, times out when the model sends nothing, times out when it goes silent mid-answer); the existing Target tests now answer with a stream. `src/suggestions/state.test.ts`: `newlyFailed` lists Suggestions that failed in this step, skips ones already failed, lists one again when its retry fails. `src/editor/ask-bubble.test.ts`: `keepInBand` keeps an on-screen anchor, moves to the bottom or top edge when the anchor is off screen, moves when the anchor line is cut by an edge, stays put when none of the range is on screen (now in `keep-in-view.test.ts`, shared by the bubble and the Cards). `src/suggestions/changes.test.ts`: where each change sits, a deletion and its insertion as one change, a pure insertion as an empty range, a block rewrite as one change, next / previous with wrapping (previous from inside a change goes to the one before), the label with the cursor anywhere in a change, when the count shows. `src/editor/suggestion-cards.test.ts`: the count on a Suggestion over two lines, "Change 1 of 1" with the cursor on it, none on a one-line Suggestion with one change. `pnpm test`: 856 tests green |
| A long Target finishes | Pass | Fix grammar on all 46 Blocks: pending for 45 s, then one Suggestion with its inline diff and Card ([24-3](img/24-3.png)). 3962 tokens in, 3808 out, `stop`, valid at the first attempt. With the old 30 s it would have failed |
| The error shows from anywhere | Pass | Model call failing (wrapped `fetch`, never reached OpenRouter), page at the top: a Toast "Could not reach the model. Check your connection, then retry." with Retry and Show ([24-1](img/24-1.png)); the error card is about 7400 px below |
| Show | Pass | `scrollY` 0 → 6975; the error card at 643–688 px of a 900 px viewport, the Toast closed ([24-2](img/24-2.png)) |
| Retry from the Toast | Pass | Sends the same request again: records 4 → 5 (`select p1–p46 → Fix grammar`, error `network`), and the new failure brings a new Toast |
| Selection bubble on a long selection | Pass | Before: with the whole Document selected, the bubble sat at the end of the selection, 7440 px down, so the checks above clicked Fix grammar through the DOM. After (maintainer's request): `Ctrl+A` at the top puts it at the bottom edge of the screen, 811–892 px of 900 ([24-4](img/24-4.png)); it stays there scrolled to the middle (`scrollY` 3473); at the end it sits by the cursor (625–707 px). A real click on its Fix grammar then started the request (wrapped `fetch`, never reached OpenRouter). At the end it shows above the cursor rather than below: CodeMirror keeps the side it flipped to at the edge |
| Where the changes are | Pass | Repeated the maintainer's run in a new tab of their Chrome (same Document, same request, real call): one Suggestion over the 122 lines with 3 changes at lines 39, 56 and 74, none on the first screen. Then, on the 46-Block Document with a Suggestion of 3 changes injected through the suggestion effects (no model call): the margin Card reads "3 changes ↑ ↓" ([24-5](img/24-5.png)); real clicks on ↓ gave "Change 1 of 3" (line 4), "Change 2 of 3" (line 40, `scrollY` 3046), "Change 3 of 3" (line 84, `scrollY` 6824), then "Change 1 of 3" again; ↑ from there gave "Change 3 of 3". While scrolled, the Card stayed at 120 px, below the header ([24-6](img/24-6.png)). At 1000 px the floating Card did the same ([24-7](img/24-7.png)) |

## Review

First pass (`opus`, medium; Standards and Spec in parallel, read-only). Fixed:

- "Change 2 of 3" only showed with the cursor exactly at a change's start (both axes). Changes are now ranges, and the label follows the cursor anywhere inside one; ↑ from inside a change goes to the one before.
- The two limits did not agree: 32768 output tokens need about 6.4 minutes at 85 tokens/s, past the 5-minute ceiling. The ceiling is now 10 minutes.
- A Card's `getCoords` recomputed its whole content (every change) on each measure, so on every scroll frame. It now reads the range kept from the last render.
- `coordsAtPos ?? lineRectAt` was written three times; it is `textRectAt` in `keep-in-view.ts` now.
- The change buttons used the version arrows' class; both use `cm-ai-step` now.
- "Change" had no GLOSSARY entry, and ADR 0007 said "↑ / ↓ move the cursor", which reads as arrow keys; they are buttons. The ADR no longer reads as if a failed Refine raised a Toast: its error shows in the Card, which stays on screen.
- Screenshots renamed `img/24-<n>.png` (AGENTS.md).
- `changeRanges` used a spread on a `reduce` accumulator (Biome warning, quadratic on big diffs); it is two linear passes now.

Left as is: no issue for this PR (the record and the PR say so, as PR #20 did); `firstChunkMs` 30 s could cut a model that thinks longer before writing, but the app sends `reasoning: 'low'` and the first token came after 1.3 s; a short failed Target shows both its card and the Toast (the maintainer chose the Toast); the PR covers four related fixes from one check; the second repeat record lacks its generation id (said in the table).

## AI call records

Read from `window.__aiCalls` (`agent-browser eval`) after the generation endpoint had filled in provider and OpenRouter latency. The forced failures (five, plus one from the bubble check) never reached OpenRouter. The key's usage counter went from US$9.148292 to US$9.172283 across the real call (+0.023992), which matches the row.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| select p1–p46 → Fix grammar | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 3962 / 3808 / 0 / 0 | 0.023992 | 45276 / 1317 / 44859 | stop | valid | gen-1793377893-uAdho0UztvwGEM4E5zFv |
| select p1–p45 → Fix grammar (the maintainer's Document, repeated in their Chrome) | openai/gpt-6.1-terra | OpenAI | 5452 / 2827 / 90 / 5449 | 0.014410 | 32998 / – / – | stop | valid | not kept (tab closed before enrichment) |
| select p1–p46 → Fix grammar (×5, forced) | openai/gpt-6.1-terra | – | – / – / – / – | – | – | – | error: network | – |

Total: US$0.038402 for 2 calls. The repeat reused 5449 cached input tokens, which shows the maintainer's own run had sent the same prompt and been answered.
