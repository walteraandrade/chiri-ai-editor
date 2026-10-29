# PR #14 verification: Chiri palette, flat UI, AI bubble keyboard and placement

[PR #14](https://github.com/walteraandrade/chiri-ai-editor/pull/14). No issue: maintainer requests from a review session after slice 6. Checked on 2026-10-28 in a real browser against `pnpm dev`. Suggestions were injected through the suggestion effects in dev mode, so no model was called.

## What was asked

| Request | Result | Evidence |
|---|---|---|
| Chiri palette, from the chiri.ai CSS tokens | Done | `src/index.css`: 3 surfaces, ink at 4 alphas, orange `#E37545`, danger; tints derived. [palette-2](img/palette-2.png) |
| Flat UI: no borders, no radius, orange ring only on focus | Done | Visible borders on the page: only `.cm-cursor` (CodeMirror draws the caret as a border). Non-zero `border-radius`: none. [palette-3](img/palette-3.png), [palette-4](img/palette-4.png) |
| Selection inset when a code block is the first rendered line | Fixed | Before: the selection is inset 12px on both sides ([palette-1](img/palette-1.png)). After: rects 273–993 = prose 273–993 ([palette-2](img/palette-2.png)). CodeMirror reads the first rendered `.cm-line`'s padding for every selection rect, so the code line's padding became a transparent `border-inline` |
| Selection hidden by the code background | Fixed | The code background stays translucent (white 5%): CodeMirror draws the selection behind line backgrounds, so an opaque one hides it |
| `Tab` leaves the app from the bubble | Fixed | Before: Shorter → Clearer → More formal → Fix grammar → Ask AI… → `<body>`. After: … → Ask AI… → Shorter. `Tab` in the editor with the bubble or the Active Suggestion card open focuses its first item, `Shift+Tab` its last. `Esc` on a bubble button dismisses it; on a card button it returns to the text without a Reject |
| The bubble vanishes while extending the selection | Fixed | Before: with `Shift+Down` the bubble sits at `top: -10000px` ([palette-5](img/palette-5.png)). After: it stays at the cursor, above when extending up, below when extending down ([palette-6](img/palette-6.png)). `Shift+Down` ×24 then `Shift+Up` ×60, checked every 3: bubble visible every time |
| The caret lands under the sticky header | Fixed | `EditorView.scrollMargins` top = header height. `Shift+Up` to the Document top (1024 × 590, frontmatter Document): before, first line at 44..64 under the header and the bubble hidden; after, caret at 73 and the bubble below it |
| AI tooltips clipped under the header | Fixed | Bubble and card use `clip: false` with z-index 20 under the header's 30, so they slide under the header on scroll instead of vanishing when their anchor crosses it |

Deviations, chosen:
- Diff colors leave the red/green convention: deleted is faint struck-through ink, inserted is light orange.
- The missing-key banner is neutral instead of amber.
- `tooltipSpaceBelow` became `spaceBelowHeader`, since it now also sets the scroll margins.

## Checks

```text
pnpm test         39 files, 627 tests passed (cycleIndex, bubblePlacement, unclipped bubble and card)
pnpm biome check  110 files, no diagnostics
pnpm build        green
```

## Screenshots

| File | What it shows |
|---|---|
| [palette-1](img/palette-1.png) | Before: old palette, selection inset 12px when a code block is the first rendered line |
| [palette-2](img/palette-2.png) | After: Chiri palette, selection aligned with the prose |
| [palette-3](img/palette-3.png) | Suggestions and the Active Suggestion card: no borders, no radius, orange ring on the focused button |
| [palette-4](img/palette-4.png) | The bubble with the orange focus ring |
| [palette-5](img/palette-5.png) | Before: extending the selection with `Shift+Down`, the bubble is gone |
| [palette-6](img/palette-6.png) | After: the bubble stays at the cursor |

## AI calls

None. No model call, US$0. [ai-costs.md](../ai-costs.md) has no rows for this PR.
