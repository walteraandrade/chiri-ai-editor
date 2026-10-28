# Slice 3 verification: inline Suggestions on a Target

Issue [#3](https://github.com/walteraandrade/chiri-ai-editor/issues/3). Checked on 2026-10-28 in a real browser (`agent-browser`, headless Chrome, 1200 x 900) against `pnpm dev`, with the model chosen at Gate A, `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)), through the Vite proxy, on the sample Document.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers the adaptive diff (both sides of the threshold), Suggestion state transitions (create, Accept, Reject, Discard, replace on overlap) and position mapping (edits outside and inside) | Pass | `src/diff/adaptive-diff.test.ts` (18 tests), `src/suggestions/state.test.ts` (42), `src/editor/suggestion-field.test.ts` (9), `src/editor/suggestion-runtime.test.ts` (11), `src/editor/ask-bubble.test.ts` (12). `pnpm test`: 348 tests green |
| Each Quick action produces a Suggestion on the sample Document | Pass | Shorter on p3: block-level, [3-3](img/3-3.png). Clearer on p8 (list): word-level, [3-6](img/3-6.png). More formal on p5: block-level, [3-8](img/3-8.png). Fix grammar on p12: word-level, [3-19](img/3-19.png). Fix grammar on the clean p4 returns the same text and shows "No change suggested", [3-16](img/3-16.png) |
| A free-text Instruction produces a Suggestion | Pass | "Drop the slang but keep a friendly tone" through the `Cmd/Ctrl+K` field ([3-8](img/3-8.png)); "Correct the spelling mistake only" through the field of the selection bubble ([3-18](img/3-18.png), [3-19](img/3-19.png)) |
| Selecting text shows the bubble with the 4 Quick actions and an "Ask AI…" field | Pass | A real mouse drag: no bubble while dragging, bubble after release, [3-1](img/3-1.png). Keyboard: `Tab` from the editor lands on Shorter, then Clearer, `Enter` asks, focus returns to the editor, [3-5](img/3-5.png) |
| `Cmd/Ctrl+K` with no selection targets the Block under the cursor | Pass | Cursor in p5: the Block is highlighted, the field is focused, [3-7](img/3-7.png). The AI call record says `cursor in p5` |
| While waiting, the Target shimmers and the bubble closes | Pass | [3-2](img/3-2.png). `Esc` while waiting cancels the request without an error card |
| Accept applies the Replacement and `Cmd+Z` restores the original | Pass | Toolbar button: Document changed, [3-4](img/3-4.png), then `Ctrl+Z` gave back the exact original text. `Ctrl+Enter` with the cursor inside, then `Ctrl+Z`, same result |
| Reject leaves the Document unchanged | Pass | `Esc` with the cursor inside: Document string identical before and after, no notice |
| Typing inside an open Suggestion Discards it with a notice | Pass | [3-11](img/3-11.png): one key inside the list Suggestion removed only that one, toast "Suggestion discarded: the text changed" |
| Typing elsewhere keeps Suggestions aligned | Pass | Seven characters typed at the start of the Document with two Suggestions open: both still strike the same words, no notice, [3-10](img/3-10.png) |
| Typing inside a pending Target aborts the request and Discards | Pass | [3-15](img/3-15.png): the request shows no status in the network log (aborted), nothing appeared afterwards, the AI call record says `aborted` |
| A new request over an open Suggestion replaces it | Pass | [3-17](img/3-17.png): toast "Suggestion discarded: replaced by your new request", one Suggestion left |
| Many Suggestions can be open at once | Pass | p5 (block-level) and the list (word-level) open together, [3-8](img/3-8.png), [3-9](img/3-9.png) |
| Only the Active Suggestion has the toolbar | Pass | [3-9](img/3-9.png): the p5 Suggestion (cursor inside) has Accept / Reject, the list one does not |
| The Rationale shows on hover and with the cursor inside | Pass | Cursor inside: [3-3](img/3-3.png). Hover on a Suggestion that is not the Active one: [3-9](img/3-9.png) |
| Forced network failure: error card with Retry | Pass | [3-12](img/3-12.png) |
| Forced `402`: "out of credit" message | Pass | [3-13](img/3-13.png). Both a real HTTP 402 and a 402 error payload inside a 200 body give it |
| Retry re-runs the same request | Pass | Route removed, Retry: the same Target and Instruction, a Suggestion appears, [3-14](img/3-14.png) |
| Positioning stays correct on scroll and resize | Pass | After scrolling and after resizing to 640 px wide the toolbar is still flush above the Suggestion (bottom of the toolbar equals the top of the Target to the pixel), [3-19](img/3-19.png), [3-20](img/3-20.png) |
| Dark theme, muted red deletions, muted green insertions | Pass | All screenshots |
| AI call records and screenshots are here, `ai-costs.md` is updated | Pass | This file and [ai-costs.md](../ai-costs.md) |

## Screenshots

| File | What it shows |
|---|---|
| [3-1](img/3-1.png) | Bubble after a real mouse drag over p3 |
| [3-2](img/3-2.png) | Shimmer on the pending Target (the sweep moves along the text) |
| [3-3](img/3-3.png) | Block-level diff (Shorter on p3), toolbar and Rationale |
| [3-4](img/3-4.png) | After Accept from the toolbar button |
| [3-5](img/3-5.png) | Keyboard: focus ring on "Clearer" after two Tab presses |
| [3-6](img/3-6.png) | Word-level diff on the list (Clearer on p8), list markers kept |
| [3-7](img/3-7.png) | `Ctrl+K` with no selection: Block highlighted, field focused |
| [3-8](img/3-8.png) | Two Suggestions open (p5 Active, list below) |
| [3-9](img/3-9.png) | Hover Rationale on the non-Active Suggestion, toolbar on the Active one |
| [3-10](img/3-10.png) | Typing before both Suggestions keeps them aligned |
| [3-11](img/3-11.png) | Discard notice after typing inside a Suggestion |
| [3-12](img/3-12.png) | Error card, network failure |
| [3-13](img/3-13.png) | Error card, out of credit |
| [3-14](img/3-14.png) | After Retry succeeded |
| [3-15](img/3-15.png) | Typing inside a pending Target (older Suggestion on p9 untouched) |
| [3-16](img/3-16.png) | "No change suggested" |
| [3-17](img/3-17.png) | New request replaced the open Suggestion |
| [3-18](img/3-18.png) | Free text typed in the selection bubble |
| [3-19](img/3-19.png) | Word-level diff of a one-word fix after scrolling, toolbar flush above |
| [3-20](img/3-20.png) | Same Suggestion at 640 px wide |

## How the checks were driven

- Selections: one real mouse drag (3-1). The others set the selection with `view.dispatch`, reaching the view through `.cm-content`'s `cmTile.view`, then used real key presses (`Ctrl+K`, `Tab`, `Enter`, `Ctrl+Enter`, `Ctrl+Z`, `Esc`, typed characters) and real clicks on the bubble and toolbar buttons.
- Forced network failure: `agent-browser network route "http://localhost:5173/api/openrouter/chat/completions" --abort`. The glob `**/api/openrouter/chat/completions` and `--body` stubs did not intercept the proxied `fetch` in this agent-browser version, so the 402 cases wrapped `window.fetch` from `eval` (a real HTTP 402 and a 200 carrying `{"error":{"code":402}}`). Neither reached OpenRouter, so they cost nothing.
- The shimmer frame (3-2) was taken with a `fetch` that never answers, so no call was made for it.

## Diff threshold

`BLOCK_LEVEL_THRESHOLD = 0.4` ([ADR 0003](../adr/0003-adaptive-diff.md)). The changed share is (deleted words + inserted words) / (words of the original + words of the Replacement), which is 1 minus the Dice similarity: 0 for identical text, 1 for no word in common. Block-level when it is above the threshold.

Calibration on the Bake-off outputs in [bakeoff.md](../bakeoff.md): 4 Quick actions x 9 models = 36 outputs.

- Sorted shares: 0.03 (the 9 Fix grammar outputs), then 0.19, 0.20, 0.31, 0.34, 0.36, 0.37, 0.38, then a jump to 0.43, 0.45, 0.45, 0.49, 0.51 and up to 0.85.
- Read by eye, everything up to 0.38 is a readable word-level diff (a few struck phrases, a few insertions). From 0.43 up, the chosen model's Shorter on p3 (0.43) already has about 15 separate changes in one paragraph. 0.4 sits in the only gap in the data.
- With the chosen model: Shorter p3 0.43 (block), Clearer p8 0.45 (block in the Bake-off run; the live run of this check gave a word-level diff, because the model answered differently), More formal p5 0.56 (block), Fix grammar p12 0.03 (word).
- Counts above the threshold: 0.3 gives 25 of 36 block-level, 0.4 gives 20, 0.5 gives 16. 0.3 would turn the readable 0.31 to 0.38 diffs into blocks. 0.5 would leave the 0.43 to 0.49 confetti as word-level.

Review pass outputs (33 edits) were not used to choose it. For reference they give 16 of 33 block-level at 0.4.

## AI call records

Read from `window.__aiCalls` (`agent-browser eval`) after the checks. The page was reloaded between groups of checks, which empties the log, so the log was read before each reload and merged; the records written before the generation endpoint filled in were enriched afterwards with the same `fetchGeneration` the app uses. Rows with no model are the forced failures (no request reached OpenRouter) and the aborted request.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| select p4 → Clearer | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 513 / 76 / 0 / 0 | 0.000893 | 2386 / 1821 / 2034 | stop | valid | gen-1793201528-XLvmdeHopx1EkY0lzTcM |
| cursor in p5 → More formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 530 / 69 / 0 / 0 | 0.000875 | 2098 / 1585 / 1757 | stop | valid | gen-1793201548-YuAU08fY49ryxm3sF2I3 |
| cursor in p5 → More formal | openai/gpt-6.1-terra | – | – / – / – / – | – | 16 / – / – | – | error: network | – |
| cursor in p5 → More formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 530 / 68 / 0 / 0 | 0.000870 | 1891 / 1411 / 1558 | stop | valid | gen-1793201578-smK3fETAELoqFEVYFYSh |
| cursor in p5 → Shorter | openai/gpt-6.1-terra | – | – / – / – / – | – | 7 / – / – | – | error: out-of-credit | – |
| select p3 → Shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 516 / 83 / 0 / 0 | 0.000931 | 2809 / 1984 / 2299 | stop | valid | gen-1793201661-hDbqTMHAMknt8YnK8Udj |
| select p8 → Clearer | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 428 / 68 / 0 / 0 | 0.000768 | 2242 / 1850 / 2004 | stop | valid | gen-1793201688-kwWlNYLRlF6Fcm0XhdXm |
| cursor in p5 → free text: Drop the slang but keep a friendly tone | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 522 / 54 / 0 / 0 | 0.000792 | 1831 / 1538 / 1556 | stop | valid | gen-1793201704-6NyeNOEqBjADqpBgeVsc |
| cursor in p9 → Shorter | openai/gpt-6.1-terra | – | – / – / – / – | – | 15 / – / – | – | error: network | – |
| cursor in p9 → Shorter | openai/gpt-6.1-terra | – | – / – / – / – | – | 2 / – / – | – | error: out-of-credit | – |
| cursor in p9 → Shorter | openai/gpt-6.1-terra | – | – / – / – / – | – | 2 / – / – | – | error: out-of-credit | – |
| cursor in p9 → Shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 437 / 32 / 0 / 0 | 0.000597 | 1537 / 1278 / 1278 | stop | valid | gen-1793201774-a4q4bhWYth9nlQi88Shj |
| cursor in p7 → Clearer | openai/gpt-6.1-terra | – | – / – / – / – | – | 178 / – / – | – | error: aborted | – |
| cursor in p4 → Fix grammar | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 500 / 71 / 0 / 0 | 0.000855 | 1935 / 1482 / 1674 | stop | valid | gen-1793201799-fOhIhOrklaRFbUKYcqyS |
| select p9 → Clearer | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 458 / 31 / 0 / 0 | 0.000613 | 1814 / 1548 / 1548 | stop | valid | gen-1793201817-ogTg50bYLA3pzvmCoamN |
| cursor in p12 → Fix grammar | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 413 / 58 / 0 / 0 | 0.000703 | 2340 / 1602 / 1605 | stop | valid | gen-1793202083-tSqTxNKJ0rX82u70DZ3a |
| select p12 → free text: Correct the spelling mistake only | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 432 / 41 / 0 / 0 | 0.000637 | 1815 / 1436 / 1436 | stop | valid | gen-1793202092-dGUX7N4TlOPvPQTtAepR |

Summary:

- 17 records: 11 valid model calls, 5 forced failures (no request reached OpenRouter, no cost: 2 network aborts and 3 out-of-credit stubs) and 1 aborted request (p7, typed inside the Target 178 ms after sending; OpenRouter returned no usage for it).
- Cost of the 11 valid calls: US/bin/zsh.008534. Median client latency 1935 ms, median OpenRouter latency 1548 ms. Every valid call finished with `stop`, none needed the silent retry.
- Not recorded: 3 more real calls made while trying the flow, one Shorter on p3 and one Fix grammar on p12 before the first reload, and one free-text call on p12 whose log was lost on a reload. They are in the cost log as an estimate from the key's usage counter.
