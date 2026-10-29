# PR #20 verification: cursor to the first review Suggestion when a pass ends

[PR #20](https://github.com/walteraandrade/chiri-ai-editor/pull/20). No issue: the maintainer asked for it while checking PR #19 ("when the Review pass ends, focus and scroll should go to the first item to resolve") and chose the first review Suggestion in the text over the most important one. Checked on 2026-10-29 in a real browser (`agent-browser`, headless Chrome, 1440 x 900) against `pnpm dev`, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document.

```text
ReviewToolbar  running → idle, focus on <body>
  controls.revealFirst()
    revealFirstReviewSuggestion(view)      # cursor at firstReviewSuggestion(state).from, scroll it to the center
    view.focus()
  else the Review button gets focus, as before
```

`firstReviewSuggestion` (`src/suggestions/review.ts`) is the open, ready review Suggestion with the smallest `from`, whatever order it arrived in. The cursor inside it makes it the Active Suggestion, so its Card has Accept / Reject / Refine and `Ctrl+Enter` / `Esc` work at once.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `src/suggestions/review.test.ts`: the first review Suggestion in the text wins over arrival order and over asked Suggestions; none when nothing is open or only pending. `src/editor/suggestion-field.test.ts`: `revealFirstReviewSuggestion` puts an empty cursor at its start, makes it Active and leaves the Document alone; returns false and keeps the cursor without one. `pnpm test`: 643 tests green |
| A pass ends at the top of the page | Pass | Cursor at 0, focus on `<body>` during the pass (the Focus popover closed). At the end: cursor at line 5 (start of p2, the first review Suggestion in the text, which arrived second), editor focused, its Card active ([review-cursor-1](img/review-cursor-1.png)). 5 Suggestions |
| A pass ends with the page scrolled to the bottom | Pass | After Reject all, `scrollY` 772. Focus "tone" pass: at the end `scrollY` 0 and the cursor at line 5, 255px from the top, editor focused ([review-cursor-2](img/review-cursor-2.png)). 2 Suggestions |
| Typing in the text during a pass moves nothing | Pass | Model call failing after 2.5 s (wrapped `fetch`, never reached OpenRouter). During the pass the cursor was put at line 20 with the editor focused; after the end: line 20, still focused |
| Control: same failure with the focus on `<body>` | Pass | After the end the cursor went to line 5: the review Suggestions of the earlier pass were still open, so they are still the first to resolve |

The cursor only moves when the focus is on `<body>` at the end, which is when the old code focused the Review button: the Focus popover and the Stop button are gone by then, so a pass started from the toolbar always qualifies, and someone who clicked into the text does not get pulled away.

## AI call records

The in-page log (`window.__aiCalls`) was lost: Vite reloaded the page when the docs were edited in the same checkout, before the log was saved. The generation ids were still in the browser's network log, and these rows come from `GET /api/v1/generation?id=…` through the proxy, so client latency and time to first Suggestion are not recorded. The three forced failures never reached OpenRouter.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review document → default criteria | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 975 / 325 / 0 / 0 | 0.002600 | – / 869 / 4378 | stop | valid | gen-1793278465-4dwL1Sw0IeX6XNZiogFa |
| review document → focus: tone | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 969 / 227 / 48 / 0 | 0.002104 | – / 1735 / 3329 | stop | valid | gen-1793278500-EWLNS4K30YDIn4znUAt1 |
| review document → default criteria (×3) | openai/gpt-6.1-terra | – | – / – / – / – | – | – | – | error: network | – |

Total: US$0.004704 for 2 calls.
