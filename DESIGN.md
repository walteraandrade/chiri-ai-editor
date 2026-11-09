---
name: Desafinado
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

# Design System: Desafinado

## 1. Overview

**Creative North Star: "The Shared Manuscript".** One page, two authors. The writer's ink is neutral; the AI writes in one color and wears one name tag, so every glance answers "who did this?". The surface is flat with square corners; depth comes from solid layers and hairlines.

Colors are not hard-coded. A Theme is 12 solid roles on `:root` (`--theme-canvas`, `-raised`, `-ink`, `-faint`, `-accent`, `-ai`, `-danger`, `-selection`, `-fill`, `-fill-hover`, `-hairline`, `-scrollbar`), and every `--color-*` token is an alias of one of them. The themes live in `src/theme/catalog.ts`: 24 Palettes from *A Dictionary of Color Combinations* Vol. 1, of which `Mood Indigo` below is the default, and the original Desafinado theme in graphite and ember. In `pnpm dev` on an Omarchy machine the current Omarchy theme, light or dark, is one more option (`config/omarchy-theme.ts`, registered in `config/renderer.ts` for both the Web and the Electron dev servers); it computes its own solid roles. See [ADR 0017](docs/adr/0017-book-themes-and-solid-colors.md).

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

One family carries the product. League Spartan appears once, in the "Desafinado" wordmark.

### Hierarchy
- **Display** (600, 1.5rem): the wordmark.
- **Headline** (700, 1.85em of body): Document `#` headings, inside the editor.
- **Body** (400, 1.0625rem, line-height 1.75): the Document. The column is 48rem wide.
- **Label** (400, 0.8125rem): buttons, Cards, the bubble and its action list.
- **Flag** (600, 0.6875rem): the AI name tag.

## 4. Elevation

Flat, always. There are no shadows. Floating surfaces (bubble, floating Card, Review popover, toast, dialogs) sit on the raised color with a 1px solid hairline (`--color-hairline`). Dialogs replace the page behind them with the canvas color, since nothing may dim it; Preferences has no backdrop, so a theme shows on the page as it is chosen.

## 5. Components

### Buttons
- **Shape:** square (0px).
- **Size:** fixed, never inherited: 30px tall, 12px side padding, Label size (0.8125rem) at weight 500. Small (`cm-ai-button-sm`): 24px, 8px, 0.75rem, for rows and the Timeline. Icon (`cm-ai-button-icon`): square.
- **Default:** `--color-fill` with a hairline and ink text; hover `--color-fill-hover` with an ink border; press scales to 0.96 in 120ms. Focus: a 2px accent outline, 2px off the edge, square. Pressed or expanded: an accent border.
- **Strong (`cm-ai-button-strong`):** the one affirmative action of a dialog or page that is not AI (Save in Leave, Create, Run Evals): an ink-strong border and weight 600.
- **Quiet (`cm-ai-button-quiet`):** no fill and no border at rest, the fill on hover; pressed, it takes the fill and an ink-strong border. For the Timeline row (Now, Full history, Evals).
- **Text action (`text-action`):** an underlined action inside a sentence (Try again, Check again), with the same focus outline.
- **Primary (Accept, Accept all):** the AI color with canvas-colored text. AI actions only.
- **Disabled:** no fill, a dashed hairline and faint text, since a Palette cannot dim a color.
- **Busy:** a slow sweep of `--color-ai-glow` across the button.

### Action list (Quick actions)
- **At rest:** the bubble shows only its input and a faint hint naming the first Quick action and `↓`.
- **Typing:** a list under the input shows the Quick actions with a word that starts with the text, name starts first, and always ends with "Ask AI: “…”" for free text. `↓` on an empty input lists them all.
- **Style:** rows on the fill color, split by raised hairlines, the match underlined. The highlighted row takes the raised color, AI text and a 1px AI outline, since a Palette may paint fill and raised the same. Skill actions carry a faint "Skill" tag.
- **Keyboard:** `↑` `↓` move and wrap, `Enter` runs the highlighted row. No entrance motion: the list changes on every keystroke.

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
- **Tree rows:** roots, Skills, folders and files are rows of one tree, indented 12px per level, with a ▸ / ▾ caret on every node that has children. A Skill row shows its name only; its description shows under it, cut at 3 lines with an ellipsis (the full text in its tooltip), while the Skill is open or the row has keyboard focus. Hover alone never shows it: rows that move under the pointer turn a click into a click on the wrong row. It unfolds in 180ms, quart-out, and folds back the same way. A node's children unfold the same way when it opens and vanish at once when it closes. A Skill with a frontmatter problem wears the danger color, and the problem shows with the description. A file that does not open in Desafinado is faint. A folder can carry a faint `· detail` (`evals/` shows its Eval count).
- **Focused row:** the canvas color and a 1px accent outline drawn inside the row, no shadow. The tree is one Tab stop; the arrow keys move the focus.

### Library rail
- **At rest:** the Library is folded at every start, whatever it was at close. A 40px rail at the left edge, on the raised color with a 1px hairline on its right edge, holds two buttons set vertically, each with its shortcut in its label: "Library" (`Ctrl+B`, `⌘B` on macOS), which reports `aria-expanded` and `aria-controls`, and "Search" (`Ctrl+P`, `⌘P`), named "Search the Library". Folded, the header still names the open file (`skill › file`). The Web build has no rail.
- **Open, in a column:** when the window fits the rail (40px), the Library (288px) and the text column (48rem, 768px, gutters included), that is from 1096px up (measured on the page without its scrollbar), the Library is its own column beside the rail, on the raised color, and the page narrows.
- **Open, over the page:** below that width the Library lies over the page's left edge, right of the rail, on the raised color with a 1px hairline on its right edge, no shadow, full height. The text under it is not dimmed. Over the page the Library also folds when the writer leaves it for the text: opening a file with `Enter` or a click, or `Esc`, puts the cursor in the text and folds it, so it never covers what the writer returned to; `Space` keeps it open. In a column nothing folds on its own.
- **Motion:** it enters sliding 16px from the left with a fade, 260ms, expo-out. Under reduced motion it appears with no animation. Folding is instant.
- **Click:** the rail button is a plain toggle: open, it folds and puts the cursor in the text; folded, it opens and focuses the tree.
- **Keyboard:** `Ctrl+B` / `Cmd+B` folded: opens and focuses the tree; open with the focus outside the Library: focuses the tree; open with the focus inside it: folds and puts the cursor back in the text. The Electron menu's View → Library does the same.

### Library search
- **Place:** a field at the top of the open Library, under its title and above New, Refresh and Add. Tab order: the field, New, Refresh, Add, the tree. `Ctrl+P` / `Cmd+P` (Electron build only; ignored under a modal dialog) opens a folded Library and puts the cursor in the field, or moves the cursor there from anywhere. The field takes the bubble input's style; its focus is the accent outline.
- **List:** under the field, in the flow of the Library (it moves New, Refresh, Add and the tree down while the field has focus), at most 12 rows, 60vh tall at most, scrolling. Rows follow the bubble's Action list: the fill color, split by raised hairlines, the match underlined (semibold). A Skill row shows its name, a faint "Skill" tag and its description under it; a file row shows its path inside the Skill and a faint "in `skill`" under it.
- **Highlighted row:** the raised color, ink text and a 1px **accent** outline drawn inside the row, since a Palette may paint fill and raised the same. Never the AI color: nothing here is AI-authored (the One Author Color Rule). Moving the mouse over a row highlights it.
- **No match:** one line in a hairline box, "No Skill or file matches “…”". A visually hidden `role="status"` line, always in the page, says "N results" or "No matches", a fixed text, so it does not change on every keystroke.
- **Pattern:** WAI-ARIA combobox. The field is `role="combobox"` with `aria-controls`, `aria-expanded` and `aria-activedescendant`; the list is a `listbox` of `option`s. `↓` `↑` move and wrap; `Enter` or a click opens the row (a Skill opens its `SKILL.md`) and puts the cursor in the text; `Esc` clears the text, a second `Esc` puts the cursor in the text. The list shows only while the field has focus.
- **Folds back:** if `Ctrl+P` or the rail's Search unfolded the Library, opening a result, or a second `Esc`, folds it again. If the Library was open, it stays open (over the page it still folds, by the overlay rule). Unsaved text asks Save, Discard or Cancel first; Cancel leaves the Library and the text of the field as they were, with the cursor in the field.
- No entrance motion: the list changes on every keystroke.

### Evals page
- **Place:** the main column, like Full history, under the title "How this Skill performs" (display font) and the Skill's name. Opened by Evals in the Timeline row, beside Full history, since both swap the main column; it shows only for a file in a Library Skill (Electron build). `Esc` or the Timeline's Now returns to the text.
- **Content:** under the Skill's name, one line with the last run's time and cost; then Run Evals and the report buttons. Two hairline boxes side by side, Did the Skill fire? and Did it help?, each with its counts in the display font over a solid meter, and one sentence for the gap. Then Each Eval: a table split by hairlines where every run is a square (solid: passed or fired; outline: failed; dashed: errored) beside its count, and a flagged Eval wears a short tag under its name stating the fact, not the diagnosis (runs disagree, fails either way, passes either way), the full reason in its tooltip. Everything is ink on canvas; the AI color marks no text here, since the CLI's judge is not the AI author (the One Author Color Rule). The exceptions are the Busy sweep on Run Evals and the breathing icon of Evals in the Timeline row: Busy is the shared button state (Review and New skill wear it too), a sweep of light and not an authorship mark.
- **Running:** the Evals icon in the Timeline row breathes for as long as a run goes, on the page or off it. On the page, Run Evals shows "Running…" and Cancel sits beside it. A page for another Skill names the Skill that runs and disables Run Evals.
- **End of a run:** with the page closed, a toast says how it ended, with Show.

### Preferences
- A panel docked to the right, with no backdrop, so the page shows the theme as it changes. One row per theme: a square radio mark (the accent, solid when chosen), name, origin, and every color of the palette. Keyboard: arrows move and apply; `Esc` closes.
- AI below the themes: Model and, in the installed app, OpenRouter key, each a row with Change, which opens its dialog over the panel. Opened from File → Preferences… or `Ctrl+,` in the Electron build; the Web build has a settings button (sliders icon) at the end of the header. Nothing else in the page opens them.
- Quick actions below AI: one row per action, split by hairlines, with the same square mark as a check box, the name, a faint "Skill" tag where it applies, then small `↑` `↓` buttons and, for the writer's own actions, Edit and Delete. Delete asks in the row (Keep, Delete). Adding or editing opens a form inline, on the canvas color with a hairline; `Esc` cancels the form without closing Preferences. Focus stays on the control that moved, or moves to the next one that can take it. Rows glide to their new place in 260ms, expo-out (measured before and after, then played back); a new row fades in from 6px above; a deleted row folds to nothing in 180ms, quart-out, before it leaves the list. Reduced motion skips all three.

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
