# PR #16 verification: margin cards for the Active Suggestion

[PR #16](https://github.com/walteraandrade/chiri-ai-editor/pull/16). No issue: the first item of the backlog after slice 6. Checked on 2026-10-28 in a real browser against `pnpm dev`. The implementer injected Suggestions through the suggestion effects in dev mode, so its checks called no model. The maintainer then checked it by hand on a pasted Document with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy.

The Active Suggestion's Card moves to the right margin, level with the Suggestion's first line, when the window has room: viewport − text right edge ≥ 24 gap + 256 card + 16 gutter, which is `clientWidth` ≥ 1312 with the 768px column. Otherwise it floats above the Suggestion as before.

## Maintainer decisions

Taken before building:
- Only the Active Suggestion's Card has Accept / Reject / Refine. Other Suggestions show their Rationale on hover, in the margin too.
- The text column stays centered. Below the width line the floating Card stays, with its old defect.
- The margin Card always shows the Rationale, so it never changes size under the pointer. [ADR 0007](../adr/0007-suggestion-lifecycle.md) is amended and [GLOSSARY](../../../GLOSSARY.md) gains **Card**.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| The margin Card at 1440px covers no text | Pass | Card top 640.92 = line top 640.92, left = text right + 24, width 256. Before: the floating card covers the end of the line above its Suggestion ([5-12](img/5-12.png)). After: [margin-cards-1](img/margin-cards-1.png) |
| A hover Card does not cover the Active Card | Pass | Hover Card top 314.66 = line top 314.66; when they collide it stacks at the Active Card's bottom + 2 ([margin-cards-2](img/margin-cards-2.png)) |
| The Card stays still under the pointer | Pass | Moving the pointer text → gap → Accept: Active Card height 115.9 and top 640.9 throughout |
| Keys | Pass | `Tab` → Accept, then cycles Accept / Reject / Refine. `Esc` → back to the text, no Reject. `Ctrl+K` → Refine opens in the Card ([margin-cards-3](img/margin-cards-3.png)). Click Accept → applied, focus back to the text |
| Scroll | Pass | +200px: Card top 114.66 = line top 114.66 |
| Resize | Pass | 1440 → 1280 floating → 1440 margin. At 1320: hiding the scrollbar gives margin, restoring it gives floating. At 1280 the floating Card is unchanged ([margin-cards-4](img/margin-cards-4.png)) |

Known limits, each a row in [BACKLOG.md](../../BACKLOG.md):
- The Card aligns with the start of its Block. Pasted text with single line breaks makes long Blocks, so a change several lines down leaves the Card far above it (seen in the maintainer's check).
- The Card keeps a fixed side to stay level with its line: near the bottom its buttons can sit below the fold, and under the sticky header it goes with its line.
- A placement change rebuilds the Card, so a Refine Instruction typed while resizing across the width line is cleared.

```text
pnpm test         40 files, 639 tests passed
pnpm biome check  112 files, no diagnostics
pnpm build        green
```

## Review

First pass `opus` (Standards + Spec). Fixed: the Card width comes only from JS; a `ResizeObserver` replaces the resize event, so scrollbar changes count; one `placements` table replaces three checks; `viewportOf` reused; a duplicate test merged; **Card** added to GLOSSARY; README alt text. Second pass `sonnet`: doc nits fixed. Its one code finding, the fixed side near the bottom, is kept by choice and logged in the backlog.

## Screenshots

| File | What it shows |
|---|---|
| [5-12](img/5-12.png) | Before (from slice 5): the floating card covers the end of the line above its Suggestion |
| [margin-cards-1](img/margin-cards-1.png) | The margin Card at 1440px, level with its Suggestion's first line |
| [margin-cards-2](img/margin-cards-2.png) | A hover Card stacked below the Active Card |
| [margin-cards-3](img/margin-cards-3.png) | Refine open inside the margin Card |
| [margin-cards-4](img/margin-cards-4.png) | At 1280px the floating Card is unchanged |

## AI calls

The maintainer's check on a pasted Document, read from `window.__aiCalls`. `window.__reviewDrops` was empty, so every Review Suggestion the model sent was shown.

| Task | Model → served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid |
|---|---|---|---|---|---|---|
| select p1 → Shorter | `openai/gpt-6.1-terra` → OpenAI | 675 / 46 / 0 / 0 | 0.000905 | 2854 / 1544 / 1544 | stop | 1/1 |
| review document → focus: Shorten the Description | `openai/gpt-6.1-terra` → OpenAI | 1907 / 198 / 0 / 0 | 0.003373 | 4052 / 1041 / 3240 (first Suggestion 4006) | stop | 1/1 |
| review document → focus: Tone | `openai/gpt-6.1-terra` → OpenAI | 1850 / 120 / 0 / 0 | 0.002912 | 2908 / 1393 / 2518 (first 2847) | stop | 1/1 |
| review document → focus: concision | `openai/gpt-6.1-terra` → OpenAI | 1837 / 792 / 0 / 0 | 0.006256 | 10447 / 926 / 9574 (first 5060) | stop | 1/1 |

Total US$0.013. Running total in [ai-costs.md](../ai-costs.md): US$0.305 of 5.00.
