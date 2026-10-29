# PR #20 verification: cursor to the first review Suggestion when a pass ends

[PR #20](https://github.com/walteraandrade/chiri-ai-editor/pull/20). No issue: the maintainer asked for it while checking PR #19 ("when the Review pass ends, focus and scroll should go to the first item to resolve") and chose the first review Suggestion in the text over the most important one. Checked on 2026-10-29 in a real browser (`agent-browser`, headless Chrome, 1440 x 900) against `pnpm dev`, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document.

```text
ReviewToolbar  running → idle
  controls.revealFirst()                   # skipped while the focus is in the text or a Card
    revealFirstReviewSuggestion(view)      # cursor at firstReviewSuggestion(state).from, scroll it to the center
    view.focus()
  else, with the focus on <body>, the Review button gets focus, as before
```

`firstReviewSuggestion` (`src/suggestions/review.ts`) is the open, ready review Suggestion with the smallest `from`, whatever order it arrived in; like Accept all, it skips one whose Refine is in flight. The cursor inside it makes it the Active Suggestion, so its Card has Accept / Reject / Refine and `Ctrl+Enter` / `Esc` work at once. If a newer Suggestion ends exactly where it starts, the cursor goes one character in, so the review one is still Active.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `src/suggestions/review.test.ts`: the first review Suggestion in the text wins over arrival order and over asked Suggestions; none when nothing is open or only pending. `src/editor/suggestion-field.test.ts`: `revealFirstReviewSuggestion` puts an empty cursor at its start, makes it Active and leaves the Document alone; still makes it Active when a newer Suggestion ends where it starts; returns false and keeps the cursor without one. `pnpm test`: 644 tests green |
| A pass ends at the top of the page | Pass | Cursor at 0, focus on `<body>` during the pass (the Focus popover closed). At the end: cursor at line 5 (start of p2, the first review Suggestion in the text, which arrived second), editor focused, its Card active ([review-cursor-1](img/review-cursor-1.png)). 5 Suggestions |
| A pass ends with the page scrolled to the bottom | Pass | After Reject all, `scrollY` 772. Focus "tone" pass: at the end `scrollY` 0 and the cursor at line 5, 255px from the top, editor focused ([review-cursor-2](img/review-cursor-2.png)). 2 Suggestions |
| Typing in the text during a pass moves nothing | Pass | Model call failing after 2.5 s (wrapped `fetch`, never reached OpenRouter). During the pass the cursor was put at line 20 with the editor focused; after the end: line 20, still focused |
| Control: same failure with the focus on `<body>` | Pass | After the end the cursor went to line 5: the review Suggestions of the earlier pass were still open, so they are still the first to resolve |
| Keyboard on the toolbar (review fix) | Pass | 1100 x 900, page scrolled to the bottom. During a real pass, focus moved to "Accept all" once it showed. At the end: cursor at line 5, editor focused, `scrollY` 0 ([review-cursor-3](img/review-cursor-3.png)). Before the fix this case kept the focus on "Accept all" and moved nothing |
| Floating Card after the scroll | Known limit | The floating Card sits below the first line, over the next two (`cm-tooltip-below`). CodeMirror keeps the side a tooltip got when it was created, and this Card was created while its line was above the viewport. The same Suggestion, injected with the page at the top, gets its Card above the line. Logged in [BACKLOG.md](../../BACKLOG.md); the margin Card is not affected |

The cursor stays put while the focus is in the text or one of its Cards, so someone working in the Document during the pass is not pulled away. Anywhere else (`<body>`, the toolbar), it moves.

## AI call records

For the first two passes the in-page log (`window.__aiCalls`) was lost: Vite reloaded the page when the docs were edited in the same checkout, before the log was saved. Their generation ids were still in the browser's network log, so those rows come from `GET /api/v1/generation?id=…` through the proxy and have no client latency or time to first Suggestion. The third pass (the keyboard check) was saved from the log right away, so it has both. The three forced failures never reached OpenRouter.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 325 / 0 / 0 | 0.002600 | – / 869 / 4378 | stop | valid | gen-1793278465-4dwL1Sw0IeX6XNZiogFa |
| review document → focus: tone | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 969 / 227 / 48 / 0 | 0.002104 | – / 1735 / 3329 | stop | valid | gen-1793278500-EWLNS4K30YDIn4znUAt1 |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 328 / 0 / 0 | 0.002615 | 5720 / 1578 / 5114 (first 2666) | stop | valid | gen-1793278872-nExlaJY05aMFjVXaisK1 |
| review document → default criteria (×3) | openai/gpt-6.1-terra | – | – / – / – / – | – | – | – | error: network | – |

Total: US$0.007319 for 3 calls.
