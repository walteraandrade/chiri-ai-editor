# Slice 5 verification: Review pass

Issue [#5](https://github.com/walteraandrade/chiri-ai-editor/issues/5). Checked on 2026-10-28 in a real browser (`agent-browser`, headless Chrome, 1200 x 900, one run at 1200 x 2000 and one screenshot at 390 x 800) against `pnpm dev`, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document. Every run that needed a fresh Document cleared `localStorage` first and reloaded.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers mapping edits to Suggestions: unknown `blockId`, unchanged Replacement, occupied Blocks, code blocks, at most 6 | Pass | `src/ai/edits.test.ts` (unknown `blockId`, unchanged, empty, duplicate, occupied, code block, cap at 6, junk guard), `src/suggestions/review.test.ts` (34: `occupiedBlockIds`, `mapBlockRange`, `placeReviewEdit`, Accept all plan, summaries), `src/editor/review-runtime.test.ts` (29: streaming, edits during the stream, Stop, errors, cap), `src/editor/suggestion-field.test.ts` (Accept all as one transaction, Reject all), `src/suggestions/state.test.ts` (origin, bulk reject and accept). `pnpm test`: 523 tests green (436 before this slice) |
| On the sample Document the first Suggestion appears before the stream ends, and the time to the first Suggestion is recorded | Pass | [5-3](img/5-3.png) is a frame taken while the pass was still streaming: one Suggestion on the "Honestly…" paragraph, the button reads "Reviewing… 1 suggestion" with Stop, the toolbar already offers Accept all / Reject all. First Suggestion visible 2683 ms after the click, the pass finished at 5753 ms ([5-4](img/5-4.png)). The call record keeps the time to the first Suggestion (table below): 34 to 99 % of the total, 1898 to 3859 ms |
| A Focus visibly changes the kind of Suggestions returned | Pass | No Focus, "tone only" and "grammar only" on a fresh Document each: 5 Suggestions on p3, p5, p8, p9, p12 (tone, concision, structure, a typo); 3 on p3, p4, p5 with only tone Rationales; 1 on p8 with a grammar Rationale. Table below, [5-4](img/5-4.png), [5-12](img/5-12.png), [5-14](img/5-14.png) |
| Accept all and Reject all work | Pass | Accept all applied the 5 Suggestions in one step ([5-9](img/5-9.png) before, [5-10](img/5-10.png) after), the cursor went back to the editor, `Ctrl+Z` once gave back the exact Document string ([5-11](img/5-11.png)). Reject all dropped the 3 tone Suggestions, the Document string was unchanged, and the toolbar went back to a lone Review button ([5-12](img/5-12.png), [5-13](img/5-13.png)). On the pass with the occupied p5, Accept all applied the 3 review Suggestions and left the user's own Suggestion open, still mapped to its text (read from the editor state), so the scope is the review ones only |
| Single Accept, Reject and Refine still work on review Suggestions | Pass | On the first pass: `Ctrl+Enter` with the cursor inside p3 applied it ([5-5](img/5-5.png)), `Esc` inside p9 dropped it and left the Document alone ([5-6](img/5-6.png)), Refine "make it more formal" on p12 ([5-7](img/5-7.png) input, [5-8](img/5-8.png) result): the Suggestion kept its range and origin, the history now has the review Instruction then the Refine, the Rationale changed |
| Edits made while the pass streams are mapped | Pass | Typed inside p3 and inserted a line at the start of the Document 332 ms after the click ([5-15](img/5-15.png)). The model's p3 edit was dropped (`text-changed`), the Suggestions on p8, p9 and p12 landed on shifted ranges and their text matched their original in the new Document |
| Occupied Blocks are skipped | Pass | A Quick-action-style Suggestion ("make it shorter") was open on p5 before the pass. The model returned p5 first: dropped as `occupied`, and p5 kept only the Suggestion the user asked for ([5-15](img/5-15.png)) |
| Stop keeps the Suggestions already shown | Pass | Stop after the first Suggestion: toast "Review stopped: 1 suggestion", the Suggestion and the Accept all / Reject all buttons stay, the request was aborted (`aborted` in the record) ([5-16](img/5-16.png) before, [5-17](img/5-17.png) after) |
| An error before any Suggestion shows the human message and Retry; after some it keeps them | Pass | A stubbed 402: "OpenRouter is out of credit. Add credit to your OpenRouter account, then retry." with a Retry button ([5-18](img/5-18.png)), Retry sent a new request. A stream that breaks after one complete edit: "Review: 1 suggestion. The model request failed (200): Failed to process successful response" with Retry, the Suggestion kept ([5-19](img/5-19.png)) |
| Keyboard | Pass | Fresh load, `Tab` lands on Review, `Enter` opens the dialog with the Focus input focused, `Esc` closes it and returns the focus to Review. `Enter` in the input submits |
| AI call records and screenshots are here, `ai-costs.md` is updated | Pass | This file and [ai-costs.md](../ai-costs.md) |

## Focus comparison

Same Document, same model, a fresh Document for each run (block ids: p3 first paragraph, p4 "Our pipeline…", p5 "Honestly…", p8 list, p9 "All deploys…", p12 "Once the canary…").

| Focus | Suggestions | Blocks | Rationales |
|---|---|---|---|
| none (default criteria) | 5 | p5, p3, p8, p9, p12 | "Uses a professional tone while preserving the caution about late Friday deploys." · "Breaks up a long sentence to make the rationale easier to follow." · "Clarifies the rollback requirement and makes its wording consistent with the list." · "Removes repetition of the review requirement." · "Corrects a spelling error." |
| tone only | 3 | p5, p3, p4 | "Uses a professional, respectful tone while retaining the caution about late Friday deploys." · "Removes language that could sound judgmental or dismissive." · "Describes the freeze's reduced value in a more measured tone." |
| grammar only | 1 | p8 | "Corrects the ungrammatical rollback-plan sentence." |

The default pass touches what the bake-off said it would (the slang, the long paragraph, the list, the repeated rule, the typo). "tone only" drops the structural and typo edits and adds p4. "grammar only" is narrow to the point of missing the `recieve` typo in p12, which is the model's call and not the app's.

## Time to the first Suggestion

| Pass | First Suggestion, call record (ms) | First Suggestion visible, from the click (ms) | Pass finished, from the click (ms) | Suggestions |
|---|---|---|---|---|
| none | 2348 | 2683 | 5753 | 5 |
| tone only | 3619 | 3832 | 5802 | 3 |
| grammar only | 3859 | 4100 | 4153 | 1 |
| none, with p5 occupied and typing | 2999 | 3519 | 4962 | 3 |
| none, tall viewport | 1898 | 2108 | 5777 | 5 |

The record's number is measured from the request start inside the client and the page numbers include the click and React. The pass streams: with 3 to 5 Suggestions the first one is on screen after 34 to 65 % of the total. A pass with one Suggestion has nothing to stream, so first and total coincide.

The cap of 6 edits and the time to the first Suggestion are counted at client validation, before the app places the edit. An edit dropped at placement (`text-changed` or `occupied`) still used a slot of the 6, and the first-Suggestion time of the record may refer to an edit that was never shown (the pass with p5 occupied and typing: 2999 ms in the record, 3519 ms until the first review Suggestion was on screen).

## Screenshots

| File | What it shows |
|---|---|
| [5-1](img/5-1.png) | Header toolbar, idle: the Review button next to the hint |
| [5-2](img/5-2.png) | Review popover with the Focus field |
| [5-3](img/5-3.png) | Mid-stream: "Reviewing… 1 suggestion" with Stop, the first Suggestion, Accept all / Reject all |
| [5-4](img/5-4.png) | The pass finished: 5 Suggestions, toast "Review: 5 suggestions" |
| [5-5](img/5-5.png) | Single Accept of p3 with `Ctrl+Enter` |
| [5-6](img/5-6.png) | Single Reject of p9 with `Esc` |
| [5-7](img/5-7.png) | Refine input open on a review Suggestion |
| [5-8](img/5-8.png) | After Refine: same Suggestion, new Replacement and Rationale |
| [5-9](img/5-9.png) | Fresh pass, tall viewport: 5 Suggestions before Accept all |
| [5-10](img/5-10.png) | After Accept all: every Replacement in the Document, toolbar back to Review |
| [5-11](img/5-11.png) | After one `Ctrl+Z`: the original Document |
| [5-12](img/5-12.png) | "tone only" on a fresh Document: 3 Suggestions |
| [5-13](img/5-13.png) | After Reject all: nothing left, Document unchanged |
| [5-14](img/5-14.png) | "grammar only" on a fresh Document: 1 Suggestion |
| [5-15](img/5-15.png) | p5 occupied and edits during the stream: no review Suggestion on p5 or p3, the others shifted; the user's own Suggestion stays |
| [5-16](img/5-16.png) | Stop test, mid-stream |
| [5-17](img/5-17.png) | After Stop: "Review stopped: 1 suggestion", the Suggestion kept |
| [5-18](img/5-18.png) | Out of credit: message and Retry |
| [5-19](img/5-19.png) | Stream broken after one Suggestion: count, message, Retry, Suggestion kept |
| [5-20](img/5-20.png) | 390 px wide: the toolbar wraps and the popover fits |

## How the checks were driven

- Real clicks and key presses for the Review button, the Focus field (`Enter`, `Esc`, `Tab`), Accept all, Reject all, Stop, Retry, `Ctrl+Enter`, `Esc`, `Ctrl+K`, `Ctrl+Z`. The cursor was placed with `view.dispatch`, reaching the view through `.cm-content`'s `cmTile.view`, and the Suggestion state was read from the editor state for the dumps.
- Timing: a `MutationObserver` stamped the first `.cm-ai-suggestion` and the "Review…" toast against the click.
- Edits during the stream: one `view.dispatch` with two changes (a line inserted at the start, 7 characters typed inside p3), sent 332 ms after Enter. The first element arrives after 1.8 s or more.
- Forced failures wrapped `window.fetch` from `eval`: a 402 body, and a streamed body with one complete edit, the start of a second, then a stream error. Neither reached OpenRouter. `window.__reviewDrops` (dev only) listed the dropped edits and their reasons: `occupied` for p5, `text-changed` for p3. No `junk` drop happened with the real model, the guard is covered by tests.
- The call log was dumped from `window.__aiCalls` before every reload. Records dumped before the generation endpoint had filled in (about 70 s) were completed afterwards from `/api/openrouter/generation?id=…` for the same generation ids.

## AI call records

Formatted with `formatRecordsTable` from `src/ai/records.ts`. The rows without a served model are the Stopped pass (aborted, usage not reported), the two stubbed 402s and the two stubbed broken streams.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 330 / 0 / 0 | 0.002625 | 5422 / 1191 / 4634 (first 2348) | stop | valid | gen-1793205596-aAjkk2XrVqasjyXyiPV1 |
| refine p12 → make it more formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 484 / 65 / 0 / 0 | 0.000809 | 2277 / 1959 / 1975 | stop | valid | gen-1793205678-61gXGyZyeQyW9FFltGIv |
| review document → focus: tone only | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 970 / 352 / 91 / 0 | 0.002730 | 5589 / 2297 / 4745 (first 3619) | stop | valid | gen-1793205768-BL7pihePCJ4BDaC8RnQC |
| review document → focus: grammar only | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 970 / 128 / 49 / 0 | 0.001610 | 3910 / 2525 / 3663 (first 3859) | stop | valid | gen-1793205790-ppnpvl4IEY5GDOgRdJJt |
| cursor in p5 → free text: make it shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 517 / 48 / 0 / 0 | 0.000757 | 1726 / 1479 / 1479 | stop | valid | gen-1793205813-K7zjJzztGUZTPhWAIcVt |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 312 / 0 / 0 | 0.002535 | 4795 / 1131 / 4514 (first 2999) | stop | valid | gen-1793205837-8sOfe2MiFPrqOiiL9uEi |
| review document → default criteria | openai/gpt-6.1-terra | – | – / – / – / – | – | 2154 / – / – (first 1616) | – | error: aborted | – |
| review document → default criteria | openai/gpt-6.1-terra | – | – / – / – / – | – | 7 / – / – | – | error: out-of-credit | – |
| review document → default criteria | openai/gpt-6.1-terra | – | – / – / – / – | – | 5 / – / – | – | error: out-of-credit | – |
| review document → default criteria | openai/gpt-6.1-terra | stub | – / – / – / – | – | 411 / – / – | error | error: api | gen-stub |
| review document → default criteria | openai/gpt-6.1-terra | stub | – / – / – / – | – | 405 / – / – (first 5) | error | error: api | gen-stub |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 331 / 0 / 0 | 0.002630 | 5566 / 1122 / 5199 (first 1898) | stop | valid | gen-1793206038-uVqD6QDkU3dJNYoXpPSR |

Summary:

- 12 records: 7 real calls (5 Review passes, 1 Refine, 1 Quick action to open the occupying Suggestion), 1 stopped Review pass, 4 forced failures.
- Cost of the 7 real calls: US$0.013696. A Review pass on the sample Document is about 975 tokens in and 130 to 350 out, US$0.0016 to US$0.0027. The Stopped pass was aborted after the first Suggestion and OpenRouter reported no usage for it, so it is not in the sum (at most about US$0.003, a whole pass).
- Every real call finished with `stop` and none needed the silent retry. The only dropped edits were the two in the run with typing: p5 (`occupied`, dropped by the client) and p3 (`text-changed`, dropped when it arrived).
- Records are in the log in order, nothing was lost to a reload.

## Review re-check

Re-run after the review of PR #12, in a real browser with `window.fetch` wrapped from `eval`: a fake streamed Review answer (5 edits, 900 ms apart) and a Refine that never answers. 0 real model calls, 0 cost.

- Active Suggestion during a pass: with the cursor in no Suggestion, the Active one stayed on the first (most important) Suggestion through all 5 arrivals, instead of following each new one.
- Sticky header and tooltips: scrolled with the Active card open and with the ask bubble near the header. Both stay below the header ([5-21](img/5-21.png), [5-22](img/5-22.png)); a card whose Suggestion has scrolled behind the header is hidden, not painted over it.
- Accept all with a Refine in flight: the Suggestion that was refining stayed open and untouched, the other 4 were applied in one step, and the toolbar went back to a lone Review button ([5-23](img/5-23.png)). One `Ctrl+Z` restored the Document.
