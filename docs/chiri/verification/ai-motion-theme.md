# Verification: AI motion and the Omarchy theme

No issue: a polish pass asked for by the maintainer. Checked on 2026-11-02 in a real browser (`agent-browser`, Chromium) against `pnpm dev`. Every Suggestion and the Review pass were injected through the suggestion and review effects in dev mode, so no check called the model.

![The whole flow: the bubble, a request with the AI caret, the word-by-word reveal, Accept landing, then a Review pass with the caret hopping between Suggestions and Accept all](img/ai-motion-flow.gif)

## Maintainer decisions

Taken before building, through the `impeccable` skill's interview:
- Motion: expressive co-author (an AI caret that travels, a word-by-word reveal, an animated border while you ask), with a calm, precise personality: expo-out easing, no bounce, no sparkle.
- Omarchy: live, light and dark. `pnpm dev` reads the current theme and follows theme switches; a light Omarchy theme renders light. This lifts the "dark theme only" line in [AGENTS.md](../../../AGENTS.md); Chiri's own theme stays dark and is the default everywhere else.
- `PRODUCT.md` and `DESIGN.md` are committed at the root as the context for later design work.

## What was built

- **Theme seeds.** Every color derives from 8 seeds on `:root` (`--theme-*`) with `color-mix()`. AI surfaces get their own tokens (`--color-ai`, `-ai-text`, `-ai-tint`, `-ai-wash`, `-ai-glow`, `-ai-ink`).
- **Omarchy plugin** ([config/omarchy-theme.ts](../../../config/omarchy-theme.ts)). Reads `~/.local/state/omarchy/current/theme/colors.toml` into a virtual module, watches `theme.name` (written last by `omarchy-theme-set`) and pushes the new theme over Vite's HMR socket. The build gets `null`, so no local theme is baked into `dist/`.
- **AI caret** ([src/editor/ai-caret.ts](../../../src/editor/ai-caret.ts)). Shown only while the AI works. A Refine wins over a pending request; a request wins over a Review pass.
- **Moments** ([src/editor/motion-field.ts](../../../src/editor/motion-field.ts)). A short-lived record of "revealed", "landed" and "settled", built from state transitions and expired by timers. Entrance animations hang on it rather than on DOM creation, because CodeMirror rebuilds marks often and a CSS animation would replay on each rebuild.

## What was checked

| Check | Result | Evidence |
|---|---|---|
| Bubble: chips rise in a stagger; with `Ctrl+K` an Ember arc orbits the border | Pass | `getAnimations()` on the bubble: `cm-ai-orbit: running` while the input has focus ([ai-motion-1](img/ai-motion-1.png)) |
| A request shows the AI caret with its Instruction at the end of the Target | Pass | Caret `is-visible`, label "More formal", over the pending wash ([ai-motion-2](img/ai-motion-2.png)) |
| A Replacement fades in word by word; the strike is drawn | Pass | Three frames, about 0 / 150 / 1200 ms ([ai-motion-3](img/ai-motion-3.png)) |
| Accept lands in the AI color, then fades to ink | Pass | Sampled color: AI text until about 300 ms, ink at about 82% alpha by 1.2 s, mark gone at 1.5 s ([ai-motion-4](img/ai-motion-4.png)) |
| Reject settles | Pass | `.cm-ai-settled` present at 50 ms, gone at 850 ms |
| Typing right after Accept ends the landing instead of replaying it | Pass | Unit test, `motion-field.test.ts` |
| Review pass: the caret starts at the top and hops to each Suggestion | Pass | Caret transform sampled every 300 ms: (0, 16) → 423 → 551 → 553 (gliding) → 366 → 309 → … → (517, 1332); toolbar shows the AI pulse and "Reviewing… 3 suggestions" |
| Refine: the caret shows the Refine Instruction; the new version reveals again | Pass | Caret "Warmer, keep it short", 2 refining marks, then 9 revealing words and "2 / 2" |
| Omarchy theme: toggle, remembered choice | Pass | `aria-pressed="true"`, `localStorage['chiri.theme'] = 'omarchy'`, body `rgb(0, 0, 0)` on Vantablack ([ai-motion-5](img/ai-motion-5.png)) |
| Light theme | Pass | Catppuccin Latte tokens applied through `applyTheme`: `data-theme-mode="light"`, hierarchy holds ([ai-motion-6](img/ai-motion-6.png)) |
| Live theme push | Pass | `touch ~/.local/state/omarchy/current/theme.name` → a probe listener got `chiri:omarchy-theme` with `vantablack` |
| Reduced motion | Pass | Emulated `prefers-reduced-motion`: caret transition 1 ms, no animation on its bar, pending shows a still AI glow |
| Phone width (390px) | Pass | No horizontal scroll (`scrollWidth` 375); the theme button is hidden below `sm` ([ai-motion-7](img/ai-motion-7.png)) |
| The build has no theme in it | Pass | `grep vantablack dist/assets/*.js` finds nothing |

Before: [ai-motion-0](img/ai-motion-0.png).

Found and fixed during the check:
- On a monochrome theme (Vantablack) the AI-colored Accept text was dimmer than Reject. Primary buttons now use strong ink on an AI tint.
- The theme button in the header wrapped the toolbar onto a third line during a Review pass. It moved to the bottom-left corner, with a solid backdrop.
- The bubble input showed the focus outline on top of the orbiting border. Inside the bubble the border is the focus signal; the Refine input keeps its outline.

Not checked:
- A real switch of the system theme. The check did not change the maintainer's desktop theme: the live path was checked with `touch` (same theme), and the light theme by applying its tokens in the page.
- A check with real model calls. The motion reads the same state the model fills, so injected Suggestions exercise the same code; a maintainer check with the model is still open.

```text
pnpm test         46 files, 711 tests passed
pnpm biome check  130 files, no diagnostics
pnpm build        green
```

## AI calls

None. Every Suggestion in these checks was injected through the effects in dev mode.

## Screenshots

| File | What it shows |
|---|---|
| [ai-motion-flow.gif](img/ai-motion-flow.gif) | The whole flow, about 19 s |
| [ai-motion-0](img/ai-motion-0.png) | Before: a Suggestion with its margin Card |
| [ai-motion-1](img/ai-motion-1.png) | The bubble asking, with the AI tag and the orbiting border |
| [ai-motion-2](img/ai-motion-2.png) | A pending request with the AI caret |
| [ai-motion-3](img/ai-motion-3.png) | The reveal, three frames |
| [ai-motion-4](img/ai-motion-4.png) | The landing after Accept, three frames |
| [ai-motion-5](img/ai-motion-5.png) | The Omarchy Vantablack theme |
| [ai-motion-6](img/ai-motion-6.png) | The Catppuccin Latte (light) theme |
| [ai-motion-7](img/ai-motion-7.png) | Phone width |
