# Verification: theme system

Issue [#79](https://github.com/walteraandrade/chiri-ai-editor/issues/79), [ADR 0017](../adr/0017-book-themes-and-solid-colors.md). Checked on 2026-11-05 in both builds, since the change is shared renderer code plus both kits:
- **Web build:** `pnpm dev --port 5311 --strictPort` in `agent-browser`'s own Chromium, 1440 x 900.
- **Electron build:** `CHIRI_DEV_PORT=5313 CHIRI_CDP_PORT=9313 CHIRI_USER_DATA_DIR=<temp dir> CHIRI_DEV_PICK_FILE=<temp file> pnpm exec electron-vite dev --inspect 9329`, attached with `agent-browser connect 9313`.

Suggestions were injected through the suggestion effects in dev mode, so no check called the model.

![All 24 Palettes in the real app, each with Suggestions open](img/79-1.png)

## How the colors were checked

A script walked every visible element in the running app and read its computed text, background and border colors and its shadow. For each Palette it compared them against that Palette's codes, and it measured each text node against its background.

| Check | Result | Evidence |
|---|---|---|
| Every Palette on the main screen with Suggestions, a Card and Preferences open: no color outside the Palette, no alpha, no shadow, no text under AA | Pass, 24 of 24, about 258 elements each | [79-3](img/79-3.png), [79-4](img/79-4.png) |
| The first scan found the key hint inside Accept under AA in every theme (1.02 to 3.22) | Fixed, rescanned | `.cm-ai-button-primary .cm-ai-kbd` |
| Model dialog and Full history, in `mood-indigo`, `cotton-tail` and `ko-ko` | Pass | [79-5](img/79-5.png), [79-6](img/79-6.png) |
| Electron: Library, an expanded skill and New skill, in `black-and-tan-fantasy` | Pass | [79-7](img/79-7.png) |
| Sources: no `color-mix(`, `box-shadow`, shadow utility or alpha color | Pass | `src/theme/hard-rule.test.ts` |
| Palettes against the book data: names, codes, sources, at least 6 colors, jobs, red, AI hue, AA, mode | Pass | `src/theme/catalog.test.ts` |

Not scanned: the Key dialog, the Leave dialog, the ask bubble, error states and Toasts, and text selection. They use the same tokens, and the source test covers them, but no one looked at them in each theme. Only 3 themes went through the dialog and History scan, and 1 through the Library scan.

## Preferences

| Check | Build | Result |
|---|---|---|
| `Ctrl+,` opens it | Web | Pass |
| The `Preferences` button opens it, `Esc` closes it | Web | Pass |
| `File > Preferences…` opens it | Electron | Pass, clicked through `Menu.getApplicationMenu()` over the main process inspector, not with a mouse |
| The native menu keeps Edit, View and Window | Electron | Pass, read from the same inspector |
| Lists the Omarchy row (dev on this machine), the Chiri theme and 24 Palettes, with name, origin and colors | Both | Pass ([79-2](img/79-2.png)) |
| A click repaints at once | Both | Pass |
| The choice survives a reload (`chiri.theme`) | Web | Pass |
| The choice is stored | Electron | Pass; a restart was not tried |
| The checked row takes focus on open | Web | Pass |

## Ellington credits

Titles were checked against secondary sources, not ASCAP or BMI: [Learn Jazz Standards](https://www.learnjazzstandards.com/blog/duke-ellington-songs/) for most, and Wikipedia or library catalogs for [C Jam Blues](https://en.wikipedia.org/wiki/C_Jam_Blues), [Azure](https://en.wikipedia.org/wiki/Azure_(song)), [Harlem Air Shaft](https://en.wikipedia.org/wiki/Harlem_Air_Shaft) and [Ko-Ko](https://keep.lib.asu.edu/items/5880). Pieces by Billy Strayhorn alone were left out. `Satin Doll` is credited to Ellington and Strayhorn.

## Open for the maintainer

- The default theme, and whether the Chiri theme stays.

## AI calls

None.
