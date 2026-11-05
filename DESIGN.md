---
name: Chiri
description: A Markdown editor where the AI works in the text as a visible, quiet co-author.
colors:
  deep-indigo: "#051230"
  dull-violet-black: "#1e0e3f"
  apricot-yellow: "#ffdd00"
  apricot-orange: "#f68c50"
  olive-yellow: "#a6a159"
  old-rose: "#d46d7a"
typography:
  display:
    fontFamily: "League Spartan Variable, Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "0.025em"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  flag:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
rounded:
  none: "0px"
spacing:
  xs: "0.35rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.5rem"
components:
  button:
    backgroundColor: "{colors.dull-violet-black}"
    textColor: "{colors.apricot-yellow}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.65rem"
  button-primary:
    backgroundColor: "{colors.apricot-orange}"
    textColor: "{colors.deep-indigo}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.65rem"
  ai-flag:
    backgroundColor: "{colors.apricot-orange}"
    textColor: "{colors.deep-indigo}"
    typography: "{typography.flag}"
    rounded: "{rounded.none}"
    padding: "0 0.3rem"
  inserted-text:
    backgroundColor: "{colors.dull-violet-black}"
    textColor: "{colors.apricot-orange}"
---

# Design System: Chiri

## 1. Overview

**Creative North Star: "The Shared Manuscript".** One page, two authors. The writer's ink is neutral; the AI writes in one color and wears one name tag, so every glance answers "who did this?". The surface is flat with square corners; depth comes from solid layers and hairlines.

Colors are not hard-coded. A Theme is 12 solid roles on `:root` (`--theme-canvas`, `-raised`, `-ink`, `-faint`, `-accent`, `-ai`, `-danger`, `-selection`, `-fill`, `-fill-hover`, `-hairline`, `-scrollbar`), and every `--color-*` token is an alias of one of them. The themes live in `src/theme/catalog.ts`: 24 Palettes from *A Dictionary of Color Combinations* Vol. 1, of which `Mood Indigo` below is the default, and the original Chiri theme in graphite and ember. In `pnpm dev` on an Omarchy machine the current Omarchy theme, light or dark, is one more option (`config/omarchy-theme.ts`, registered in `config/renderer.ts` for both the Web and the Electron dev servers); it computes its own solid roles. See [ADR 0017](docs/chiri/adr/0017-book-themes-and-solid-colors.md).

## 2. Colors

These are the default theme's colors, `Mood Indigo`. Another Theme puts its own colors in the same roles.

### Primary
- **Apricot Orange** (#f68c50): the AI's color. Its name flag, its caret, its words, the primary Accept button, the pulse in the Review button.

### Neutral
- **Deep Indigo** (#051230): page and editor background.
- **Dull Violet Black** (#1e0e3f): side panels, dialogs, bubble, Cards, popovers, toasts, and the fill under AI words.
- **Apricot Yellow** (#ffdd00): all text. Strong, body and muted ink are one color; hierarchy comes from size and weight.
- **Olive Yellow** (#a6a159): links, focus rings, faint text, hairlines and scrollbars. Faint is for decoration and disabled controls, and it passes AA too.
- **Old Rose** (#d46d7a): errors only.

### Named Rules
**The Hard Rule.** At rest, the app paints only the Theme's exact codes: no `color-mix()`, alpha colors or shadows (`src/theme/hard-rule.test.ts` looks for them). Hover and disabled are other palette colors. Animations may pass through in-between tones. Text-edge antialiasing is out of scope.
**The Palette Rule.** A Palette joins 2 Vol. 1 combinations that share a color, has at least 6 colors and invents none. Every color has a job, one is a red for errors, the AI color is a real hue, and all text passes AA (`src/theme/catalog.test.ts`).
**The One Author Color Rule.** Only AI-authored things use `--color-ai*`. Writer text, chrome and selection never borrow it.
**The Ownership Rule.** AI text stays in the AI color until accepted; on Accept it lands in the AI color with a soft glow, holds for ~0.4s and fades to the writer's ink by 1.4s. Under reduced motion it shows in the AI color for the same 1.5s, without the fade.

## 3. Typography

**Display Font:** League Spartan (app title only)
**Body Font:** Inter Variable

One family carries the product. League Spartan appears once, in the "Chiri" wordmark.

### Hierarchy
- **Display** (600, 1.5rem): the wordmark.
- **Headline** (700, 1.85em of body): Document `#` headings, inside the editor.
- **Body** (400, 1.0625rem, line-height 1.75): the Document. The column is 48rem wide.
- **Label** (400, 0.8125rem): buttons, chips, Cards, the bubble.
- **Flag** (600, 0.6875rem): the AI name tag.

## 4. Elevation

Flat, always. There are no shadows. Floating surfaces (bubble, floating Card, Review popover, toast, dialogs) sit on the raised color with a 1px solid hairline (`--color-hairline`). Dialogs replace the page behind them with the canvas color, since nothing may dim it; Preferences has no backdrop, so a theme shows on the page as it is chosen.

## 5. Components

### Buttons
- **Shape:** square (0px).
- **Default:** `--color-fill` with a hairline and ink text; hover `--color-fill-hover`; press scales to 0.96 in 120ms.
- **Primary (Accept, Accept all):** the AI color with canvas-colored text.
- **Disabled:** no fill, a dashed hairline and faint text, since a Palette cannot dim a color.
- **Busy:** a slow sweep of `--color-ai-glow` across the button.

### Chips (Quick actions)
- **Style:** same as buttons; hover turns to the raised color with AI text, since a chip is a request to the AI.
- **Entrance:** rise 3px and fade, staggered 35ms per chip.

### The AI flag (signature)
- A small tag in the AI color, reading "AI", in canvas-colored text. It marks every AI surface: the caret, the bubble's input, the Card's Rationale.

### The AI caret (signature)
- A 2px bar in the AI color with the flag above it, showing the Instruction ("AI · More formal ···"). It exists only while the AI works: a request, a Refine, a Review pass. It appears where the writer asked, travels (560ms, expo-out) to the end of the Target, and during a Review pass hops to each Suggestion as it streams in. It breathes while thinking and fades out when the work lands.

### Suggestions in the text
- **Deleted text:** ink with a 1px strike drawn left to right in 420ms, across wrapped lines.
- **Inserted text:** AI color on the raised color; the words fade in one by one (34ms apart, 560ms budget) from a soft AI glow, which ends with the animation.
- **Pending / refining:** no fill at rest, with a slow 1.8s sweep.
- **Active Suggestion:** the raised color and a 1px AI underline, since a Palette may paint every Suggestion the same.
- **Accepted:** lands in AI color, then fades to ink. **Rejected:** the original text flashes a neutral fill and settles in 420ms.

### Lists (Library)
- **Open file:** the canvas color behind medium-weight ink, with a solid 6px accent square before the name. The skill that holds it gets an accent caret.

### Preferences
- A panel docked to the right, with no backdrop, so the page shows the theme as it changes. One row per theme: a square radio mark (the accent, solid when chosen), name, origin, and every color of the palette. Keyboard: arrows move and apply; `Esc` closes.

### Scrollbars
- Native scrollbars, themed: a 4px square thumb (`--color-scrollbar`; ink on hover) on a clear track, no arrow buttons. Firefox gets `scrollbar-width: thin` with the same colors.

### Bubble
- Hairline border; when its input has focus, a 70° arc of the AI color orbits the border every 3.6s ("listening"). Enters with a 6px rise, 0.98 scale and a 3px blur, 260ms.

### Cards
- Margin Cards slide in 8px from the text; floating Cards rise. Switching the Active Suggestion cross-fades the content in 240ms.

## 6. Do's and Don'ts

### Do:
- **Do** use an existing role for every new color. Add a role only if a Palette can fill it with one of its own colors.
- **Do** give every animation a reduced-motion state: no travel, no loops, state shown by color alone.
- **Do** keep feedback motion between 120ms and 420ms, expo-out or quart-out. Three documented exceptions: the landing fade (1.4s), the AI caret's travel (560ms) and the theme crossfade (420ms, in-out, since it is not feedback).
- **Do** tie an entrance animation to a state change in `motionField`, not to DOM creation: CodeMirror rebuilds marks often.

### Don't:
- **Don't** build a chatbot sidebar; the AI lives in the text.
- **Don't** use AI purple gradients, sparkle icons, glowing "magic" buttons, glassmorphism or gradient text.
- **Don't** use bounce or elastic easing, confetti, or page-load choreography.
- **Don't** use the AI color for anything the AI did not author.
- **Don't** add `color-mix()`, alpha colors, opacity at rest or shadows.
- **Don't** use a colored side stripe (border-left wider than 1px) on Cards or callouts.
