# Verification: Library rail

Issue [#101](https://github.com/walteraandrade/chiri-ai-editor/issues/101), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Library, folding). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11 on `:99`), `HOME=<scratch>/fx/home CHIRI_DEV_PORT=5313 CHIRI_CDP_PORT=9313 CHIRI_USER_DATA_DIR=<scratch>/ud-after pnpm dev:electron -- --ozone-platform=x11 --inspect=9323`, attached with `agent-browser connect 9313`. The window is 1280px wide by default; `agent-browser set viewport` set the 1440 and 900 widths (`innerWidth` read back). State was read with `eval` on `document.activeElement` and the Library panel (`hidden`, `aria-expanded`).

**Keys:** `Ctrl+B` went through `agent-browser press` (CDP key events). A second pass sent real X key events with XTEST (`XTestFakeKeyEvent`, a script in the scratchpad) to the window, to see the Electron menu accelerator and the renderer handler together. **Focus moves through `eval`:** putting the cursor in the text (`.cm-content.focus()`) before a press, and focusing the `pr-format` tree item before the arrow keys that opened its `SKILL.md`; the Library was opened and folded by keys only. **Menu:** the View menu was read and its Library item clicked from the main process through the Node inspector (`--inspect=9323`), since `agent-browser` cannot drive a native menu.

Fixture, in the session scratchpad, never the real `~/.claude/skills` (`HOME` pointed at a temp dir): 21 Skills, `pr-format` with Evals, a missing second root `~/.agents/skills`.

**Before** is the parent commit (`b027cbc`) run from its own `git worktree` (own `pnpm install`, own user data folder), same fixture: [101-1](img/101-1.png) at 1440px, [101-2](img/101-2.png) at 900px. The worktree was removed afterwards.

| Check | Result |
|---|---|
| Before: the Library is a 288px column at every width, open from the start; at 900px it leaves 612px for the page and the text wraps tighter ([101-1](img/101-1.png), [101-2](img/101-2.png)) | Shown |
| Start: folded. `aria-expanded=false`, panel `hidden`, rail button only ([101-3](img/101-3.png)) | Pass |
| Rail button click (`agent-browser click`): folded → open with the focus on the tree item; open → folded with the focus on `.cm-content`; folded → open again. A click moves the focus to the button, outside the panel, which is why it is a plain toggle and not the key's three answers | Pass |
| Overlay rule, 900px: with the focus in the tree, `Enter` on the open file folded the Library and put the cursor in the text; `Ctrl+B` to open and `Esc` folded it with the cursor in the text; `Space` kept it open with the focus on the tree item | Pass |
| Column rule, 1440px: `Enter` on a file and `Esc` left the Library open, cursor in the text | Pass |
| A modal `<dialog open>` (Preferences, `Ctrl+,`): `Ctrl+B` changed nothing and `defaultPrevented` stayed `false` for the key, with the key from CDP and from XTEST and with a menu click | Pass |
| Rail button: name "Library" (snapshot: `button "Library" [expanded=false]`), `title` "Library (Ctrl+B)", visible `Ctrl+B` inside it, `aria-keyshortcuts` `Control+B`, `aria-controls` the panel, `aria-expanded` follows the state | Pass |
| Restart folded: the Library was left open, the app was closed and started again with the same user data folder; `aria-expanded=false`, panel `hidden` | Pass |
| `Ctrl+B`, answer 1, cursor in the text and Library folded: the Library opened, `aria-expanded=true`, the focus on the roving tree item (`role=treeitem`, inside `[role=tree]`) ([101-4](img/101-4.png)) | Pass |
| Answer 2, Library open, cursor put in the text with `eval`, `Ctrl+B`: the Library stayed open and the focus moved to the tree item | Pass |
| Answer 3, focus in the tree, `Ctrl+B`: the Library folded (`hidden`), the focus on `.cm-content` | Pass |
| `Ctrl+B` with the cursor in the text works (CodeMirror does not swallow it: the handler is on `window` in the capture phase and stops the event) | Pass |
| Double firing, real X key press (XTEST) of `Ctrl+B` on the real window, with a `MutationObserver` on the panel's `hidden`: one mutation, one toggle | Pass |
| Menu: View → Library, accelerator `CmdOrCtrl+B`, `registerAccelerator` `false` on this Linux build, read from `Menu.getApplicationMenu()` with the stock View items after it | Pass |
| Menu click, focus in the tree: folded and the focus on the text. A second click: opened and the focus on the tree. Mutation count went 1 → 2 → 3, one toggle per click | Pass |
| 1440px, open: its own column beside the 40px rail, the page keeps its 48rem text column, the header and the Preferences and Model buttons clear of the rail ([101-4](img/101-4.png)) | Pass |
| Fit boundary, on `document.documentElement.clientWidth` (the Electron window's classic scrollbar takes 10px of `innerWidth`): `clientWidth` 1095 (`innerWidth` 1105) `position: fixed`, 1096 (1106) `position: sticky`; 40 + 288 + 768 = 1096. The text column's `max-w-3xl px-6` is border-box, so its box is 768px | Pass |
| 900px, open: the Library lies over the page's left edge, right of the rail; computed `position: fixed`, `left: 40px`, `box-shadow: none`, `background-color: rgb(30, 14, 63)` = `--theme-raised` `#1e0e3f`, right border `rgb(166, 161, 89)` = `--theme-hairline` `#a6a159` ([101-5](img/101-5.png)) | Pass |
| 900px, open: Preferences and Model sit right of the overlay, not under it ([101-5](img/101-5.png)); folded they sit at the page's left, right of the rail ([101-6](img/101-6.png)) | Pass |
| Folded, with `pr-format/SKILL.md` open, the header reads `pr-format › SKILL.md` at 1440 and at 900 ([101-3](img/101-3.png), [101-6](img/101-6.png)). `skill › file` after the separator change (`pr-format › SKILL.md`, read from `header.innerText`) | Pass |
| Motion: opening starts one `library-in` animation of 260ms (`getAnimations()`); with `prefers-reduced-motion: reduce` emulated, `animation-name` is `none` (no slide) | Pass |
| Elevation: `box-shadow` is not `none` on 0 elements of the page | Pass |
| Web build (`pnpm dev`, port 5315, a headless browser on its own session): no rail button, no panel, no `aside`; `Ctrl+B` in the text reached the page and `defaultPrevented` stayed `false` ([101-7](img/101-7.png)) | Pass |

Double firing. Linux and Windows: the menu item sets `registerAccelerator: false` (Electron's `MenuItem`, `@platform linux,win32`), so the key reaches only the renderer, which owns it; the accelerator stays in the menu as a label. Checked on Linux: one real X key press gave one toggle (earlier pass, before this change, and again here with the dialog check). macOS, by the docs only: `registerAccelerator` does not apply there, so the menu key equivalent stays. Whichever of the two sees `Cmd+B` first handles it; the renderer stops the event when it sees it first, and the menu never gets a key the page handled. As a last guard the renderer ignores a menu request that arrives within 150ms of a key it handled (`isEchoOfKey`, unit-tested; the window check could not time two processes that closely).

Not checked: macOS itself; an empty tree (the focus then goes to the Add button, by code); a screen reader.

Covered by tests: `library-fold.test.ts` (the three answers of the key decision, `Ctrl` vs `Cmd` by platform, modifiers and other keys ignored), `library-layout.test.ts` (the fit decision from the widths, with the 1096px boundary), `library-fold.test.ts` also for the rail's answer, the echo window and the open-dialog check, `library-view.test.ts` (the `›` label), `menu-template.test.ts` (View → Library, its accelerator, its click, the stock View items kept, no second `CmdOrCtrl+B`, `registerAccelerator` off on Linux and Windows, on for macOS), `electron-kit.test.ts` (the Library requests carried).

No model calls, so no row in `ai-costs.md`.
