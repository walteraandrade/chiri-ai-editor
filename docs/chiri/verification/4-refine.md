# Slice 4 verification: Refine

Issue [#4](https://github.com/walteraandrade/chiri-ai-editor/issues/4). Checked on 2026-10-28 in a real browser (`agent-browser`, headless Chrome, 1200 x 900) against `pnpm dev`, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers the Refine prompt (original text, Instruction history, latest Replacement) and the Suggestion history update | Pass | `src/ai/prompts.test.ts` (`buildRefinePrompt`: original, history in order and numbered, latest Replacement, new Instruction, Neighbors, title and section, enclosing Block, the 5 fixed rules), `src/suggestions/state.test.ts` (69: begin, resolve, unchanged, failure, retry, Accept / Reject / Discard / mapping while refining), `src/suggestions/instruction.test.ts`, `src/editor/suggestion-runtime.test.ts` (25), `src/editor/refine-input.test.ts` (8), `src/editor/suggestion-keymap.test.ts` (10), `src/editor/suggestion-field.test.ts` (14). `pnpm test`: 426 tests green |
| The Active Suggestion's toolbar has Refine, which opens a small input | Pass | [4-1](img/4-1.png) (third button), [4-2](img/4-2.png) (input focused inside the toolbar card). `Esc` in the input closes only the input, the Suggestion stays. `Ctrl+K` with the cursor inside a ready Suggestion opens the input, not the Ask bubble |
| Two consecutive Refines each update the Suggestion in place, and the diff stays against the original text | Pass | "make it shorter" then "now more formal" on p3: [4-3](img/4-3.png) (working), [4-4](img/4-4.png) (first Refine), [4-5](img/4-5.png) (second). Same Suggestion, same range, still Active, new Rationale each time. The struck text is the original paragraph in every frame, and the Document string was unchanged |
| The model gets the original, the Neighbors, every previous Instruction and the latest Replacement | Pass | The body of the third Refine (read from the wrapped `fetch`): `<original>` is the untouched paragraph, `<context-before>` and `<context-after>` hold the Neighbors, "Previous instructions, oldest first" lists the Shorter Quick action text, "make it shorter" and "now more formal", `<latest-replacement>` is the output of the second Refine, then "New instruction: drop the adjectives". Task labels read `refine p3 → now more formal` |
| While refining, the Replacement stays visible and shows that it is working | Pass | [4-3](img/4-3.png) and [4-10](img/4-10.png): the Replacement keeps showing, a slow shimmer runs over the inserted text, and the toolbar button reads "Refining…" (disabled, `aria-busy`). Word-level diffs shimmer on each inserted word. Under `prefers-reduced-motion` the CSS falls back to a static tint (not exercised in the browser) |
| Accept after Refine applies the latest Replacement, `Ctrl+Z` restores the original | Pass | After two Refines and a third, `Ctrl+Enter`: the paragraph is the latest Replacement, no Suggestion left, [4-9](img/4-9.png). `Ctrl+Z` gave back the exact original Document string |
| Accept and Reject still work during a Refine and abort it | Pass | Cancel (`Esc`) during a Refine: the first `Esc` cancels the Refine and aborts the request (`aborted` in the record), the Suggestion keeps its Replacement; the second `Esc` Rejects it, no notice, Document unchanged. The same two-step `Esc` dismisses the error of a failed Refine (see the review re-check below). Accept (`Ctrl+Enter`) during a Refine: the current Replacement is applied, [4-12](img/4-12.png), request aborted, `Ctrl+Z` restores the original |
| Typing inside the Suggestion during a Refine Discards it with the notice and aborts the request | Pass | [4-10](img/4-10.png) then [4-11](img/4-11.png): one key inside the range, toast "Suggestion discarded: the text changed", the in-flight request's `AbortSignal` was aborted, the record says `aborted` |
| A failed Refine shows Retry without losing the current Replacement | Pass | Network failure: [4-6](img/4-6.png). The error sits inside the toolbar card, the struck original, the Replacement and the Rationale are unchanged, Accept / Reject / Refine are still there. Retry failing again with a 402 body gives the own message, [4-7](img/4-7.png). Retry again with the real model: the Suggestion updates in place, [4-8](img/4-8.png), and the request body lists the earlier Instructions without the two failed attempts |
| "No change suggested" when a Refine returns the current Replacement | Pass | A stubbed answer equal to the Replacement: toast "No change suggested", Replacement and Rationale kept, the Suggestion is idle again, [4-13](img/4-13.png) |
| The input survives a toolbar re-render | Pass | Typing "abc" in the Refine input, then hovering the Suggestion and leaving it (which re-renders the card): text and focus kept, [4-14](img/4-14.png) |
| AI call records and screenshots are here, `ai-costs.md` is updated | Pass | This file and [ai-costs.md](../ai-costs.md) |

## Screenshots

| File | What it shows |
|---|---|
| [4-1](img/4-1.png) | Shorter on p3: toolbar with Accept, Reject and Refine |
| [4-2](img/4-2.png) | Refine input open inside the toolbar card |
| [4-3](img/4-3.png) | First Refine in flight: "Refining…" and the shimmer, Replacement still visible |
| [4-4](img/4-4.png) | After "make it shorter": updated in place, original still struck |
| [4-5](img/4-5.png) | After "now more formal" |
| [4-6](img/4-6.png) | Failed Refine (network): inline error and Retry, Replacement kept |
| [4-7](img/4-7.png) | Retry answered with a 402: the out-of-credit message |
| [4-8](img/4-8.png) | Retry with the real model: the Suggestion updated |
| [4-9](img/4-9.png) | After Accept: the latest Replacement is in the Document |
| [4-10](img/4-10.png) | Refine in flight on a word-level diff: shimmer on the inserted words |
| [4-11](img/4-11.png) | Typed inside the refining Suggestion: Discarded, notice shown |
| [4-12](img/4-12.png) | Accept during a Refine: the current Replacement applied |
| [4-13](img/4-13.png) | "No change suggested" after a Refine that repeats the Replacement |
| [4-14](img/4-14.png) | Input with text kept after a card re-render |
| [4-15](img/4-15.png) | Review re-check: a failed Refine on a non-Active Suggestion (dotted underline) with its error in the hover card |
| [4-16](img/4-16.png) | Review re-check: Refine in flight on a deletion-only diff, shimmer on the struck words |

## How the checks were driven

- Real key presses and clicks: `Ctrl+K` (Ask bubble and Refine input), `Enter`, `Esc`, `Ctrl+Enter`, `Ctrl+Z`, typed characters, clicks on the toolbar buttons. Selections and the cursor were set with `view.dispatch`, reaching the view through `.cm-content`'s `cmTile.view`.
- Forced failures wrapped `window.fetch` from `eval`: a `TypeError` for the network failure, a 402 body for out of credit. A fetch that never answers (and honors the abort signal) held a Refine in flight for the Accept, Reject and Discard checks and for the shimmer frames. A canned answer stood in for the model on the "no change" check. None of these reached OpenRouter, so they cost nothing.
- The log was dumped from `window.__aiCalls` after about 70 s, so the generation endpoint had filled in provider and OpenRouter latency.

## AI call records

Read from `window.__aiCalls` (`agent-browser eval`) and formatted with `formatRecordsTable` from `src/ai/records.ts`. Rows with no model served are the two forced failures, the three aborted requests (never answered, no usage reported) and the stub (`stub`, cost 0).

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cursor in p3 → Shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 516 / 86 / 0 / 0 | 0.000946 | 2640 / 1667 / 2022 | stop | valid | gen-1793203816-4He5ilFaXiQwKvpYv0At |
| refine p3 → make it shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 616 / 70 / 0 / 0 | 0.000966 | 2487 / 1763 / 1973 | stop | valid | gen-1793203848-O3hsbrtAh7V6020UNqqF |
| refine p3 → now more formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 606 / 79 / 0 / 0 | 0.001001 | 1994 / 1483 / 1738 | stop | valid | gen-1793203860-a5AUpk2kbFhztTzUPjpp |
| refine p3 → drop the adjectives | openai/gpt-6.1-terra | – | – / – / – / – | – | 3 / – / – | – | error: network | – |
| refine p3 → drop the adjectives | openai/gpt-6.1-terra | – | – / – / – / – | – | 3 / – / – | – | error: out-of-credit | – |
| refine p3 → drop the adjectives | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 616 / 78 / 0 / 0 | 0.001006 | 2035 / 1526 / 1791 | stop | valid | gen-1793203889-Jxi9YVwOPYGpCOi5N8oW |
| cursor in p4 → Clearer | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 513 / 74 / 0 / 0 | 0.000883 | 2036 / 1591 / 1795 | stop | valid | gen-1793203917-R6SUqFboSOcSjbvDKkrh |
| refine p4 → make it shorter | openai/gpt-6.1-terra | – | – / – / – / – | – | 1454 / – / – | – | error: aborted | – |
| cursor in p5 → More formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 533 / 67 / 0 / 0 | 0.000868 | 1954 / 1634 / 1728 | stop | valid | gen-1793203942-ut5steZ4iNCPL6P5BEKW |
| refine p5 → make it warmer | openai/gpt-6.1-terra | – | – / – / – / – | – | 931 / – / – | – | error: aborted | – |
| cursor in p5 → More formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 533 / 69 / 0 / 0 | 0.000878 | 2380 / 1923 / 2089 | stop | valid | gen-1793203955-fRgb3X8FpIlstC8HoPeN |
| refine p5 → make it warmer | openai/gpt-6.1-terra | – | – / – / – / – | – | 929 / – / – | – | error: aborted | – |
| cursor in p1 → Shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 404 / 30 / 0 / 0 | 0.000554 | 1566 / 1327 / 1327 | stop | valid | gen-1793203978-BxkiV3AcyIGXO4CSk6Zd |
| refine p1 → make it shorter | openai/gpt-6.1-terra | stub · stub | 0 / 0 / 0 / 0 | 0.000000 | 2 / – / – | stop | valid | gen-stub |

Summary:

- 14 records: 8 real model calls (5 Quick actions to open Suggestions, 3 Refines), 2 forced failures, 3 aborted requests and 1 stub.
- Cost of the 8 real calls: US$0.007102 (4337 tokens in, 553 out, no reasoning, no cache). Median client latency 2036 ms, median OpenRouter latency 1634 ms. The three real Refines took 2487, 1994 and 2035 ms (client), about 100 input tokens more than a Quick action because of the history and the latest Replacement. Every real call finished with `stop`, none needed the silent retry.
- Every call is in the log: nothing was lost to a reload. The `cursor in p1 → Shorter` call came from a miss of my search string that put the cursor in the title, and it was kept because it opened the Suggestion for the "no change" check.

## Review re-check

Re-run after the review of PR #11, in a real browser with `window.fetch` wrapped from `eval` so that no request reached OpenRouter (0 real model calls, 0 cost; a canned 200 body opened each Suggestion, a hanging `fetch` held a Refine in flight, a rejected `fetch` failed it).

- `Esc` during a Refine: the first press cancels it (request aborted, Suggestion and Replacement kept), the second Rejects. `Ctrl+K` during a Refine opens nothing.
- `Esc` with a failed Refine: the first press dismisses the error and the dotted marker, the second Rejects.
- Refine input text: typed "leaked text" in Suggestion A, moved the cursor into Suggestion B, `Ctrl+K`: the input opened empty.
- Failed Refine on a non-Active Suggestion: dotted underline on its range and the error line in its hover card, [4-15](img/4-15.png).
- Deletion-only diff while refining: the struck words shimmer, [4-16](img/4-16.png).
