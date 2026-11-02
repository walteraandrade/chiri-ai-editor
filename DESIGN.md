---
name: Chiri
description: A Markdown editor where the AI works in the text as a visible, quiet co-author.
colors:
  graphite-canvas: "#141417"
  raised-graphite: "#28282d"
  paper-white-ink: "#f1f1f3"
  ember-accent: "#e37545"
  ember-text: "#f0a179"
  signal-red: "#f87171"
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
    backgroundColor: "{colors.raised-graphite}"
    textColor: "{colors.paper-white-ink}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.65rem"
  button-primary:
    backgroundColor: "{colors.ember-accent}"
    textColor: "{colors.paper-white-ink}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.65rem"
  ai-flag:
    backgroundColor: "{colors.ember-accent}"
    textColor: "{colors.graphite-canvas}"
    typography: "{typography.flag}"
    rounded: "{rounded.none}"
    padding: "0 0.3rem"
  inserted-text:
    backgroundColor: "{colors.ember-accent}"
    textColor: "{colors.ember-text}"
---

# Design System: Chiri

## 1. Overview

**Creative North Star: "The Shared Manuscript".** One page, two authors. The writer's ink is neutral; the AI writes in one color and wears one name tag, so every glance answers "who did this?". The surface is flat graphite with square corners; depth comes from tonal layers and a single soft shadow on floating surfaces.

Colors are not hard-coded. Every token derives from eight theme seeds on `:root` (`--theme-bg`, `--theme-raised`, `--theme-ink`, `--theme-ink-strong`, `--theme-accent`, `--theme-ai`, `--theme-danger`, `--theme-selection`) through `color-mix()`. The default seeds are the Chiri theme below; in `pnpm dev` on an Omarchy machine the seeds come from the current Omarchy theme, light or dark (`config/omarchy-theme.ts`). A new theme is eight colors, not a new stylesheet.

## 2. Colors

### Primary
- **Ember** (#e37545): the AI's color. Its name flag, its caret, the tint under its words, the primary Accept button, the pulse in the Review button. Also links and focus rings (`--color-accent`), which share the seed by default but have their own token.

### Neutral
- **Graphite Canvas** (#141417): page and editor background.
- **Raised Graphite** (#28282d, derived as canvas + 9% ink): bubble, Cards, popovers, toasts.
- **Paper White Ink** (#f1f1f3): strong ink for headings and controls; body ink is the same at 82%, muted 62%, faint 40%.
- **Signal Red** (#f87171): errors only.

### Named Rules
**The One Author Color Rule.** Only AI-authored things use `--color-ai*`. Writer text, chrome and selection never borrow it.
**The Ownership Rule.** AI text stays in Ember until accepted; on Accept it lands in Ember and fades to the writer's ink over ~1.2s.

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

Flat at rest. Floating surfaces (bubble, floating Card, Review popover, toast) get a 1px hairline (`--color-hairline`, ink at 9%) and one ambient shadow; margin Cards sit flat beside the text.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 32px var(--color-shadow)`): anything that covers text. `--color-shadow` is black at 50% in dark themes and a soft 16% in light ones.

## 5. Components

### Buttons
- **Shape:** square (0px).
- **Default:** `--color-fill` (ink 6%) with ink text; hover `--color-fill-hover` (11%) and strong ink; press scales to 0.96 in 120ms.
- **Primary (Accept, Accept all):** AI at 18% behind strong ink; hover 28%.
- **Busy:** a slow sweep of `--color-ai-glow` across the button.

### Chips (Quick actions)
- **Style:** same as buttons; hover turns to the AI tint with AI text, since a chip is a request to the AI.
- **Entrance:** rise 3px and fade, staggered 35ms per chip.

### The AI flag (signature)
- A small Ember tag reading "AI", in canvas-colored text. It marks every AI surface: the caret, the bubble's input, the Card's Rationale.

### The AI caret (signature)
- A 2px Ember bar with the flag above it, showing the Instruction ("AI · More formal ···"). It exists only while the AI works: a request, a Refine, a Review pass. It appears where the writer asked, travels (560ms, expo-out) to the end of the Target, and during a Review pass hops to each Suggestion as it streams in. It breathes while thinking and fades out when the work lands.

### Suggestions in the text
- **Deleted text:** faint ink with a 1px strike drawn left to right in 420ms, across wrapped lines.
- **Inserted text:** AI text on the AI tint; the words fade in one by one (34ms apart, 560ms budget) from a soft AI glow.
- **Pending / refining:** a 6% AI wash with a slow 1.8s sweep.
- **Accepted:** lands in AI color, then fades to ink. **Rejected:** the original text flashes a neutral fill and settles.

### Bubble
- Hairline border; when its input has focus, a 70° arc of Ember orbits the border every 3.6s ("listening"). Enters with a 6px rise, 0.98 scale and a 3px blur, 260ms.

### Cards
- Margin Cards slide in 8px from the text; floating Cards rise. Switching the Active Suggestion cross-fades the content in 240ms.

## 6. Do's and Don'ts

### Do:
- **Do** derive every new color from the theme seeds with `color-mix()`, so Omarchy themes keep working.
- **Do** give every animation a reduced-motion state: no travel, no loops, state shown by color alone.
- **Do** keep feedback motion between 120ms and 420ms, expo-out or quart-out; only the landing fade runs longer.
- **Do** tie an entrance animation to a state change in `motionField`, not to DOM creation: CodeMirror rebuilds marks often.

### Don't:
- **Don't** build a chatbot sidebar; the AI lives in the text.
- **Don't** use AI purple gradients, sparkle icons, glowing "magic" buttons, glassmorphism or gradient text.
- **Don't** use bounce or elastic easing, confetti, or page-load choreography.
- **Don't** use the AI color for anything the AI did not author.
- **Don't** use a colored side stripe (border-left wider than 1px) on Cards or callouts.
