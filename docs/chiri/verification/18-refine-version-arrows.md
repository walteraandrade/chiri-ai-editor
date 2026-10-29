# Issue #18 verification: Refine version arrows

Issue [#18](https://github.com/walteraandrade/chiri-ai-editor/issues/18). Checked on 2026-10-29 in a real browser (`agent-browser`, headless Chrome) against `pnpm dev`, with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document. 1440 x 900 for the margin card, 1100 x 900 for the floating Card.

The Active Suggestion's Card shows `‹ n / m ›` and the shown step's Instruction once its `history` has 2 or more steps. `ReadySuggestion` gains `shown`, the index of the shown step; `replacement`, `rationale` and `diff` mirror that step, so Accept and the decorations read them unchanged.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers showing a version and Refine from an earlier version | Pass | `src/suggestions/state.test.ts`: `showVersion` (newest step after each Refine; `replacement`, `rationale` and `diff` follow the shown step, diff against the original; bounds `-1`, `3`, `0.5`; same step; ignored while refining; after a failed Refine it steps and dismisses the error, so Retry has nothing to re-run; unknown, pending and error Suggestions; other Suggestions untouched), Refine from an earlier step (success cuts the later steps and appends; "no change" keeps them; failure keeps them; retry then success cuts; cancel keeps them), `instructionHistory` stops at the shown step. `src/editor/suggestion-runtime.test.ts`: the request from `1/3` carries only the first Instruction and its Replacement, then the history is `[first, new]`. `src/editor/suggestion-cards.test.ts`: arrows absent with one step, present from 2, follow the shown step, locked while refining, absent on the hover card. `pnpm test`: 660 tests green |
| The arrows show only with 2 or more steps, and fit the margin card (256px) and the floating Card | Pass | One step: Accept / Reject / Refine only. Margin card: [18-1](img/18-1.png), the arrow row is 243px wide inside the 256px card, a long Instruction ends in an ellipsis ([18-3](img/18-3.png)). Floating Card: [18-5](img/18-5.png) |
| Stepping updates the inline diff, the Rationale and the counter in place; the diff stays against the original | Pass | `3 / 3` → `2 / 3` → `1 / 3` with clicks: the counter, the Instruction ("use a warmer tone", "make it shorter", "More formal"), the Rationale and the inserted text change; the struck text is the original paragraph every time. [18-1](img/18-1.png) then [18-2](img/18-2.png). A mouse click leaves focus in the text |
| Accept applies the shown version, `Ctrl+Z` restores the original | Pass | At `1 / 2`, Accept: the paragraph is the `1 / 2` Replacement, no Card left ([18-4](img/18-4.png)). `Ctrl+Z`: the original paragraph is back |
| A Refine from `1/3` sends only the Instructions up to `1/3` and its Replacement, and the result replaces `2/3` and `3/3` | Pass | Request body below. The answer gives `2 / 2` with the new Instruction "say we now deploy on weekdays" ([18-3](img/18-3.png)); stepping back gives `1 / 2` "More formal" |
| The arrows are disabled while refining and reachable with Tab | Pass | During each Refine the snapshot shows `Previous version [disabled]`, `Next version [disabled]` and `Refining… [disabled]`. At `1 / 3`, `Tab` from the text focuses "Next version" (Previous is disabled). `Enter` steps to `2 / 3` with focus kept; `Enter` again reaches `3 / 3`, Next turns disabled and focus moves to "Previous version"; `Enter` gives `2 / 3` |
| ADR 0007 is amended and `docs/BACKLOG.md` drops the item | Pass | [ADR 0007](../adr/0007-suggestion-lifecycle.md), [BACKLOG.md](../../BACKLOG.md) |
| AI call records and screenshots are here, `ai-costs.md` is updated | Pass | This file and [ai-costs.md](../ai-costs.md) |

Extra checks:
- **A failed Refine drops nothing.** With `window.fetch` failing the model call (no request reached OpenRouter), a Refine from `1 / 2` showed "Could not reach the model…" with Retry and kept both steps ([18-7](img/18-7.png)); `Esc` dismissed it and both steps stayed.
- **Stepping dismisses a failed Refine's error** (review fix). Without it, a Retry after stepping re-sent the failed Instruction on top of another version. After the fix, on a reloaded page with a 2-step Suggestion injected through the suggestion effects (no model call): a forced failure at `2 / 2`, then "Previous version" gives `1 / 2`, its Rationale, and no error or Retry ([18-8](img/18-8.png)). The only record is that forced failure (`refine p4 → fail please`, error).
- **The Refine input survives a version step.** Typing "abc" in the Refine input, then clicking "Previous version": focus stays in the input with "abc", the counter reads `1 / 2`, and the next key types into it ([18-6](img/18-6.png)). The Card now updates its children in place (`syncChildren` in `src/editor/dom.ts`) instead of replacing them all, so the input and the arrow row stay in the page; the old refocus step for the input went away with it.
- **"No change" adds no step.** "keep the ten percent rollout detail" came back equal to the shown Replacement: no new step, no arrows (the existing `resolveRefine` rule).

## Maintainer check: version shortcuts

The maintainer tried the build and found no way to switch versions from the keyboard besides Tab. The issue had decided "no dedicated shortcut in v1"; the maintainer chose `Ctrl+H` / `Ctrl+L`, active only with the cursor inside a Suggestion with 2 or more versions. Checked on the maintainer's `pnpm dev`, with a 2-step Suggestion injected through the suggestion effects (no model call):

| Check | Result |
|---|---|
| In the app today, outside Suggestions | `Ctrl+←` jumps a word, `Alt+←` jumps to the paragraph start, `Ctrl+]` / `Ctrl+[` indent and outdent the line. `Ctrl+]` inside a block Suggestion indents its line and keeps the Suggestion (an insert at its start counts as outside) |
| `Ctrl+H` / `Ctrl+L` inside | `2 / 2` → `1 / 2` (Rationale "First.") → `2 / 2`; at `1 / 2` another `Ctrl+H` changes nothing and the Document is untouched ([18-9](img/18-9.png)) |
| `Ctrl+H` outside a Suggestion | Text and caret unchanged, the arrows keep their version. Whether the browser's History opens there was not checked: headless Chrome has no browser UI |
| Hint | The arrows' tooltip reads "Previous version (Ctrl+H)" (`⌃H` on macOS), with `aria-keyshortcuts="Control+H"` |

`src/editor/suggestion-keymap.test.ts` covers the command: it steps both ways, keeps the key at either end and while refining (so the browser does not act on it), and passes it on with a single version or outside every Suggestion. `src/ui/platform.test.ts` covers the `⌃` / `Ctrl+` hint.

## Request body of the Refine from `1/3`

The user message of the fourth call (`refine p5 → say we now deploy on weekdays`), read from a HAR of the session. The history lists only the first Instruction, and `<latest-replacement>` is the `1 / 3` Replacement, not the `3 / 3` one:

```text
Previous instructions, oldest first:
1. Make the tone more formal and professional. Keep the meaning and the level of detail.

<latest-replacement>
The old freeze was a significant inconvenience and was widely disliked. We are therefore removing it, but please do not deploy a major change at 5pm on Friday and then leave it unattended over the weekend.
</latest-replacement>

New instruction: say we now deploy on weekdays
```

## Screenshots

| File | What it shows |
|---|---|
| [18-1](img/18-1.png) | Margin card at `3 / 3` after two Refines |
| [18-2](img/18-2.png) | Stepped back to `1 / 3`: the first Replacement, its Rationale and "More formal" |
| [18-3](img/18-3.png) | After the Refine from `1 / 3`: `2 / 2`, long Instruction cut with an ellipsis |
| [18-4](img/18-4.png) | After Accept at `1 / 2`: the first Replacement is in the Document |
| [18-5](img/18-5.png) | Floating Card at 1100px with `2 / 2` |
| [18-6](img/18-6.png) | Refine input with text and focus kept after a version step |
| [18-7](img/18-7.png) | Failed Refine from `1 / 2`: error and Retry, both steps kept |
| [18-8](img/18-8.png) | After a failed Refine at `2 / 2`, stepping to `1 / 2` dismissed the error |
| [18-9](img/18-9.png) | `Ctrl+H` stepped to `1 / 2` from the keyboard |

## AI call records

Read from `window.__aiCalls` (`agent-browser eval`) after the generation endpoint had filled in provider and OpenRouter latency, and formatted with `formatRecordsTable` from `src/ai/records.ts`. The last row is the first forced failure. The second, `refine p4 → fail please` from the re-check after the review fix, came from a reloaded page and is not in this table. Neither reached OpenRouter.

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cursor in p5 → More formal | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 530 / 68 / 0 / 0 | 0.000870 | 3304 / 1888 / 2270 | stop | valid | gen-1793275570-z07MzjPmgK9bO4CvANv9 |
| refine p5 → make it shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 609 / 60 / 0 / 0 | 0.000909 | 2467 / 2171 / 2189 | stop | valid | gen-1793275586-TLKxqNGB1aUXC09mVhXe |
| refine p5 → use a warmer tone | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 609 / 62 / 0 / 0 | 0.000919 | 1999 / 1677 / 1696 | stop | valid | gen-1793275598-qYrKPNxrOCi6eYBe9BCa |
| refine p5 → say we now deploy on weekdays | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 612 / 72 / 0 / 0 | 0.000972 | 2475 / 1673 / 1949 | stop | valid | gen-1793275648-yqKkZmRjSfGIAmipdMV4 |
| cursor in p4 → Shorter | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 511 / 57 / 0 / 0 | 0.000796 | 2662 / 2201 / 2229 | stop | valid | gen-1793275691-Cq9KOcCkyWhZ7Fj4HSB8 |
| refine p4 → keep the ten percent rollout detail | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 585 / 60 / 0 / 0 | 0.000885 | 2236 / 1946 / 1971 | stop | valid | gen-1793275700-irA8ywZ2Q2QUZt54hzc3 |
| refine p4 → turn it into a single sentence | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 585 / 56 / 0 / 0 | 0.000865 | 2360 / 1604 / 1635 | stop | valid | gen-1793275761-swRayqIWxSL02Bv96kkw |
| refine p4 → abcd | openai/gpt-6.1-terra | – | – / – / – / – | – | 3 / – / – | – | error: network | – |

Total: US$0.006216 for 7 calls.
