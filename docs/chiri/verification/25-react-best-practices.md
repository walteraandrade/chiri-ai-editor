# Issue #25 verification: React best practices

[Issue #25](https://github.com/walteraandrade/chiri-ai-editor/issues/25). Four findings from a review against Vercel's [react-best-practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) skill. Checked on 2026-10-30 and, after the first code review, again on 2026-10-31, in a real browser (`agent-browser`, headless Chrome, 1280 x 577) against `pnpm dev` (`StrictMode`) and `vite preview` of `pnpm build`, on the sample Document. The model was simulated: `window.fetch` was wrapped in the page to answer `/api/openrouter` with an OpenRouter-shaped stream (or a 402 for the failure case), and `/api/openrouter/**` was also aborted at the network level, so no request could reach OpenRouter.

```text
before                                        after
markdown({ base: markdownLanguage })          new LanguageSupport(markdownLanguage), Prec.high(keymap.of(markdownKeymap)), pasteURLAsLink
browser-client loads on the first AI request  whenIdle(client.preload) once the editor mounts
ReviewToolbar effect: running → idle          createReviewRuntime({ onEnd }) → revealAfterReviewPass(view)
                                              → App.onReviewEnd(revealed): if not revealed and the focus is on <body>, focus the Review button
EditorPane handlersRef + sync effect          one useEffectEvent per callback
Review button and Stop button                 one button, whose ref App owns
```

## What was checked

| Check | Result | Evidence |
|---|---|---|
| TDD | Pass | Red first, then green. `src/ai/lazy-client.test.ts`: `preload` loads once and a later request reuses it; a failed preload stays quiet and the next request loads again. `src/ui/idle.test.ts`: `whenIdle` uses `requestIdleCallback` with a 2000 ms timeout and cancels it by its id, and falls back to a timer. `src/editor/review-runtime.test.ts`: `onEnd` runs once after the run is cleared on done, on error and on Stop (also when the final event arrives after Stop); never when nothing was reviewable, on a Stop with no pass, or on destroy. `pnpm test`: 681 tests green |
| Main chunk | Pass | `pnpm build`: `index-*.js` 786.59 kB (gzip 265.73) on `main`, 601.13 kB (gzip 194.11) now. The new chunk's source map lists none of `@codemirror/lang-html`, `lang-css`, `lang-javascript`, `@codemirror/autocomplete`, `@lezer/html`, `@lezer/css`, `@lezer/javascript`. `browser-client-*.js` is unchanged at 495.41 kB |
| Markdown editing, compared with `main` | Pass, one difference | The same steps on a `main` build and on this one, with real key presses, gave the same Document strings: Enter after `- first item` adds `- `, then Backspace leaves two spaces; Enter after `> quoted` adds `> `; Enter twice after `1. one` gives `1. one\n\n2. `; pasting `https://example.com` over "docs" gives `[docs](https://example.com)`; `<em>` typed in a paragraph stays `<em>`. HTML comments and tags render with the same markup. **Difference:** `<div>` typed at the start of a line becomes `<div></div>` on `main` (lang-html's `autoCloseTags`, added by `markdown()`) and stays `<div>` here |
| AI chunk preload | Pass | With no input after load: `browser-client-*.js` requested at 345 ms (preview build); `/src/ai/browser-client.ts` and the `ai` dependency at 686 ms (dev) |
| `StrictMode` mount | Pass | Dev, after the double mount: one `.cm-editor` on the page |
| A: pass ends with a Suggestion | Pass | During the pass the focus is on `<body>` (the Focus popover closed), as on `main`. At the end: cursor at 67 (start of p3, the review Suggestion), editor focused, toast "Review: 1 suggestion" ([25-2](img/25-2.png)) |
| B: pass ends with no Suggestion | Pass | Focus on `<body>` during the pass; at the end on the Review button, toast "Review: no suggestions" ([25-1](img/25-1.png)) |
| C: Stop before any Suggestion | Pass | Focus stays on the Review button (the one that said Stop), toast "Review stopped: no suggestions" |
| D: Stop after one Suggestion | Pass | Cursor at 67, editor focused, toast "Review stopped: 1 suggestion" |
| E: typing in the text during a pass | Pass | Cursor put at 20 with the editor focused during a slow pass; at the end still 20 |
| F: Retry from the toast (review fix) | Pass | A pass failed with a simulated 402 ("OpenRouter is out of credit…", with Retry). Clicking Retry removed the toast, so the focus fell to `<body>`; the retried pass found nothing, and the Review button took the focus. Two calls to the simulated `/api/openrouter` |
| Button attributes | Pass | Running: `aria-busy="true"`, no `aria-expanded`. Idle: `aria-expanded="false"` |

The six Review cases gave the same results on dev and on the preview build. The browser's network log had no request to `/api/openrouter`.

Seen in passing, not from this change: at 1280 px the floating Card of the first review Suggestion covers the `## Why we are changing` heading. A `main` build shows the same.

## After the rebase onto PR #22

On 2026-10-31 the change was rebased onto `feat/open-save-markdown` (PR #22, with #23 and #24 inside), to merge it there. Conflicts were in `App.tsx`, `EditorPane.tsx`, `review-controls.ts`, `review-runtime.test.ts` and `ai-costs.md`; both sides were kept. PR #22's `review-controls.test.ts` stopped listing `revealFirst`, which `ReviewControls` no longer has. Checked again on the combined tree:

| Check | Result |
|---|---|
| `pnpm test`, `pnpm biome check`, `tsc --noEmit`, `pnpm build` | 863 tests green, no diagnostics, green |
| Main chunk against PR #22's head | `index-*.js` 812.59 kB (gzip 274.42) → 627.00 kB (gzip 202.76); `browser-client-*.js` 477.18 kB on both |
| Preload and `StrictMode` | `browser-client` at 326 ms (preview) and 782 ms (dev) with no input; one `.cm-editor` in dev |
| Review cases A–F | Same results as above, on dev and on the preview build; no request reached `/api/openrouter` |
| Markdown keys | Same Document strings as above |

## Code review

First pass (`opus`, medium; Standards and Spec), with what was done:

- **Fixed.** The end-of-pass effect also focused the Review button when the focus was on `<body>`; the first version of this change dropped that, so Retry from the toast, or a click on the page during a pass, left the focus on `<body>`. `revealAfterReviewPass` now returns whether it moved the cursor, and `App.onReviewEnd` focuses the Review button through the ref it owns (cases B and F).
- **Fixed.** Submitting the Focus popover moved the focus to the button that becomes Stop, so a second Enter could stop the pass. Submit closes the popover without moving the focus, as on `main`.
- **Fixed.** `useEffectEvent` functions were handed to CodeMirror directly; they are now called from wrappers, as React's rules ask.
- **Fixed.** The idle tests depended on `push` returning 1 as the id; the mocks return explicit ids.
- **Documented.** `<div>` no longer auto-closes (row above).
- **Kept.** The `?.` in `whenIdle`'s cancel: TypeScript does not keep the narrowing inside the returned closure, and destructuring the method would lose `this` on `window`. The one-line comment in `extensions.ts`, since it is why `markdown()` is not used.

## AI call records

None. Every check used the simulated model, so nothing was billed and [ai-costs.md](../ai-costs.md) keeps its total.

## Screenshots

| File | What it shows |
|---|---|
| [25-1](img/25-1.png) | A pass ended with no Suggestion: the focus ring on the Review button, the toast "Review: no suggestions" |
| [25-2](img/25-2.png) | A pass ended with one: cursor at the start of the review Suggestion in p3, its Card, the toast |
