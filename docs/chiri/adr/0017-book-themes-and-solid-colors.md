# 0017. Book themes and solid colors

- Status: Accepted (2026-11-05)
- Source: maintainer request and grilling session (Q1 to Q26); throwaway prototype on branch `claude/seigensha-color-combinations-3a0c9e`
- Amends: [0016](0016-web-and-electron-builds.md) (the Web build gets the Preferences screen, as shared UI)

## Context

The maintainer asked for a theme system inspired by *A Dictionary of Color Combinations*, with at least 6 colors per theme, "absolute fidelity of tone", and a Preferences screen on the desktop and on the web.

Every color token derived from 8 seeds through `color-mix()`, plus alpha and one soft shadow, so most pixels were not any color a theme named.

The data pushes back. Vol. 1 has 348 combinations of 2, 3 or 4 colors, so none reaches 6. Only 12 Vol. 2 palettes are public; the rest sit in a paid app, and their codes differ from Vol. 1 for the same names (`Lilac` is `#b984af` and `#bf87b0`). No source is official: the codes are conversions of printed inks.

## Decision

- **Source: Vol. 1 only**, through the MIT dataset by Matt DesLauriers (CMYK converted with documented ICC profiles). One code per color, used as published. A copy of the dataset lives in `src/theme/testing/` so a test can check every theme against it.
- **A palette joins 2 combinations that share a color** and has at least 6 colors. Joining 3 was rejected: it reaches any number of themes, but with 8 to 10 colors far from anything Wada composed. The maintainer accepted fewer themes over that; the rules happen to leave exactly 24.
- **Hard rule: at rest, the app paints only exact palette codes.** No `color-mix()`, alpha color or shadow; a test scans the renderer's sources for them. Hover and disabled use another palette color. Animations may pass through in-between tones, and text-edge antialiasing is out of scope. Floating surfaces get a solid hairline instead of a shadow.
- **AA still holds**, checked per palette: ink, AI, accent, faint and danger on canvas and raised; ink on fill, fill hover and selection; AI on selection; canvas on AI, for the primary button.
- **Fewer roles.** A theme is 12 roles (`canvas`, `raised`, `ink`, `faint`, `accent`, `ai`, `danger`, `selection`, `fill`, `fillHover`, `hairline`, `scrollbar`). Strong, body and muted ink are one color; hierarchy comes from size and weight. The fill under AI words is `raised`. The `--color-*` tokens stay as aliases, so the UI classes did not change.
- **Palettes name colors, not codes.** A palette's jobs refer to its own color names, so a theme cannot paint a code outside its palette. Every color has a job.
- **Each palette has a red for errors** (pinkish reds count), and the AI color is a real hue, not black or gray.
- **The default is `Mood Indigo`**, picked by the maintainer once all 24 ran in the app. The stylesheet's defaults and the Electron window background match it. The Chiri theme stays as a 25th option, with its own solid colors. Omarchy stays dev-only, outside the hard rule, and computes its roles in the plugin; in `pnpm dev` on an Omarchy machine it still wins when nothing is stored.
- **Preferences:** one screen in both builds, themes only. A click applies at once, and the choice lives in `chiri.theme`. Electron opens it from a native `File > Preferences…` item and `Ctrl+,`; the Web build from a button and `Ctrl+,`. The native menu keeps the Edit, View and Window menus Electron gave by default. No user themes, no font choice.
- **Names are Duke Ellington compositions** where Ellington is a credited composer. The screen credits Wada, the dataset and Ellington, and says the pairings are ours, not Wada's.

## Consequences

- The app looks flatter: no soft shadow, and borders and fills are full-strength colors. The maintainer saw all 24 in the real app before this was built and kept them all.
- Text hierarchy got weaker. Muted text no longer looks muted.
- Several palettes are loud to write on: 5 have a `Lemon Yellow` canvas. They stayed by the maintainer's choice.
- The original five prototype themes are gone: their colors cannot reach 6 by these rules without inventing tones.
- Fidelity means fidelity to the published code, not to the printed page.
- The test copy of the dataset adds 60 KB to the repo, outside the bundle.
- Graphite and Ember stop being the face of the app. The Chiri theme keeps them as an option.

## Alternatives considered

- **Vol. 2 data from the Wada Colors site:** closer to Wada for 4 palettes with 6 colors, but no clear license, and only 4 themes.
- **Tints allowed (the "paint rule"):** kept hierarchy and far more candidates. The maintainer chose the hard rule.
- **A rendered gallery page:** the prototype showed each theme in the real editor instead, with a switcher.
