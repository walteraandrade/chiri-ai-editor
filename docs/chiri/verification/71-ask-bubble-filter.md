# Issue #71 verification: ask bubble filters Quick actions in its input

[Issue #71](https://github.com/walteraandrade/chiri-ai-editor/issues/71). The maintainer chose option D from the mocks: no chips, the bubble's input filters the Quick actions. Shorter, Clearer and Fix grammar are on by default. Checked on 2026-11-07 with `agent-browser` (headless Chrome, 1280 x 577) against `pnpm dev`, Mood Indigo and the Omarchy dark theme, on the sample Document, then by the maintainer by hand.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | `src/editor/ask-menu.test.ts`: rows (empty query, browsing, word-start match, label starts first, free text last and trimmed, matched span) and menu state (typing, moves that wrap, browsing on `↓`, hover, chosen row, hint). `src/ai/prompts.test.ts`: default ids, chosen order, skill actions only for a skill. `pnpm test`: 2983 green |
| At rest | Pass | `Ctrl+K` in a paragraph: input and hint only ([71-1](img/71-1.png)) |
| Typing filters | Pass | "gr": Fix grammar, then "Ask AI: “gr”"; first row highlighted ([71-2](img/71-2.png)). "r" alone matches no word start, so only "Ask AI: “r”" shows |
| `↓` on an empty input | Pass | Lists all three actions, hint hidden, `aria-expanded` true, `aria-activedescendant` on row 0 ([71-3](img/71-3.png)) |
| `↑` wraps | Pass | From row 0 to Fix grammar; `Enter` then started Fix grammar |
| Hint is the input's description | Pass | `aria-describedby` points at the hint's id |
| `Esc` | Pass | Bubble closes |
| `Enter` on an action | Pass | "fix" + `Enter`: AI caret reads "Fix grammar" |
| `Enter` on free text | Pass | "tone only" + `Enter`: AI caret reads "tone only" |
| Click on a row | Pass | Clearer clicked: AI caret reads "Clearer" |
| Highlighted row in themes that paint fill and raised alike | Fixed | In Mood Indigo and Omarchy dark it only changed text color, and in Omarchy the AI color is grey. Now it also has a 1px AI outline |

## AI call records

None recorded. The first automated checks ran without a key, so those requests ended before reaching OpenRouter. After review, the `↑` + `Enter` check ran with the key and sent one Fix grammar request on one paragraph; the browser was closed before `window.__aiCalls` was read, so its cost is not known. The maintainer's hand test was not logged either.
