# Verification: Library rail

Issue [#101](https://github.com/walteraandrade/chiri-ai-editor/issues/101), [ADR 0020](../adr/0020-evals-page-and-foldable-library.md) (Library, folding). Checked on 2026-11-08 in the Electron build, off-screen (`xvfb-run`, X11 on `:99`), `HOME=<scratch>/fx/home CHIRI_DEV_PORT=5313 CHIRI_CDP_PORT=9313 CHIRI_USER_DATA_DIR=<scratch>/ud-after pnpm dev:electron -- --ozone-platform=x11 --inspect=9323`, attached with `agent-browser connect 9313`. The window is 1280px wide by default; `agent-browser set viewport` set the 1440 and 900 widths (`innerWidth` read back). State was read with `eval` on `document.activeElement` and the Library panel (`hidden`, `aria-expanded`).

**Keys:** `Ctrl+B` went through `agent-browser press` (CDP key events). A second pass sent real X key events with XTEST (`XTestFakeKeyEvent`, a script in the scratchpad) to the window, to see the Electron menu accelerator and the renderer handler together. **Focus moves through `eval`:** putting the cursor in the text (`.cm-content.focus()`) before a press, and focusing the `pr-format` tree item before the arrow keys that opened its `SKILL.md`; the Library was opened and folded by keys only. **Menu:** the View menu was read and its Library item clicked from the main process through the Node inspector (`--inspect=9323`), since `agent-browser` cannot drive a native menu.

Fixture, in the session scratchpad, never the real `~/.claude/skills` (`HOME` pointed at a temp dir): 21 Skills, `pr-format` with Evals, a missing second root `~/.agents/skills`.

**Before** is the parent commit (`b027cbc`) run from its own `git worktree` (own `pnpm install`, own user data folder), same fixture: [101-1](img/101-1.png) at 1440px, [101-2](img/101-2.png) at 900px. The worktree was removed afterwards.

| Check | Result |
|---|---|
| Before: the Library is a 288px column at every width, open from the start; at 900px it leaves 612px for the page and the text wraps tighter ([101-1](img/101-1.png), [101-2](img/101-2.png)) | Shown |
| Start: folded. `aria-expanded=false`, panel `hidden`, rail button only ([101-3](img/101-3.png)) | Pass |
| Rail button: name "Library" (snapshot: `button "Library" [expanded=false]`), `title` "Library (Ctrl+B)", visible `Ctrl+B` inside it, `aria-keyshortcuts` `Control+B`, `aria-controls` the panel, `aria-expanded` follows the state | Pass |
| Restart folded: the Library was left open, the app was closed and started again with the same user data folder; `aria-expanded=false`, panel `hidden` | Pass |
| `Ctrl+B`, answer 1, cursor in the text and Library folded: the Library opened, `aria-expanded=true`, the focus on the roving tree item (`role=treeitem`, inside `[role=tree]`) ([101-4](img/101-4.png)) | Pass |
| Answer 2, focus in the tree, `Ctrl+B`: the Library folded (`hidden`), the focus on `.cm-content` | Pass |
| Answer 3, Library open, cursor put in the text with `eval`, `Ctrl+B`: the Library stayed open and the focus moved to the tree item | Pass |
| `Ctrl+B` with the cursor in the text works (CodeMirror does not swallow it: the handler is on `window` in the capture phase and stops the event) | Pass |
| Double firing, real X key press (XTEST) of `Ctrl+B` on the real window, with a `MutationObserver` on the panel's `hidden`: one mutation, one toggle | Pass |
| Menu: View → Library, accelerator `CmdOrCtrl+B`, read from `Menu.getApplicationMenu()` with the stock View items after it | Pass |
| Menu click, focus in the tree: folded and the focus on the text. A second click: opened and the focus on the tree. Mutation count went 1 → 2 → 3, one toggle per click | Pass |
| 1440px, open: its own column beside the 40px rail, the page keeps its 48rem text column, the header and the Preferences and Model buttons clear of the rail ([101-4](img/101-4.png)) | Pass |
| Fit boundary: at 1143px `position: fixed` (over the page), at 1144px `position: sticky` (column); 40 + 288 + 816 = 1144 | Pass |
| 900px, open: the Library lies over the page's left edge, right of the rail; computed `position: fixed`, `left: 40px`, `box-shadow: none`, `background-color: rgb(30, 14, 63)` = `--theme-raised` `#1e0e3f`, right border `rgb(166, 161, 89)` = `--theme-hairline` `#a6a159` ([101-5](img/101-5.png)) | Pass |
| 900px, open: Preferences and Model sit right of the overlay, not under it ([101-5](img/101-5.png)); folded they sit at the page's left, right of the rail ([101-6](img/101-6.png)) | Pass |
| Folded, with `pr-format/SKILL.md` open, the header reads `pr-format / SKILL.md` at 1440 and at 900 ([101-3](img/101-3.png), [101-6](img/101-6.png)). The text is `skill / file`, the separator the header already used; the issue writes `›` | Pass, see below |
| Motion: opening starts one `library-in` animation of 260ms (`getAnimations()`); with `prefers-reduced-motion: reduce` emulated, `animation-name` is `none` (no slide) | Pass |
| Elevation: `box-shadow` is not `none` on 0 elements of the page | Pass |
| Web build (`pnpm dev`, port 5315, a headless browser on its own session): no rail button, no panel, no `aside`; `Ctrl+B` in the text reached the page and `defaultPrevented` stayed `false` ([101-7](img/101-7.png)) | Pass |

Not checked: macOS (`Cmd+B`, the menu key equivalent taking the key first); the accelerator path alone (with the renderer handler on, the key never reaches the menu, which only the XTEST pass shows as a single toggle); a screen reader; `Ctrl+B` while a dialog is open.

Covered by tests: `library-fold.test.ts` (the three answers of the key decision, `Ctrl` vs `Cmd` by platform, modifiers and other keys ignored), `library-layout.test.ts` (the fit decision from the widths, with the boundary), `menu-template.test.ts` (View → Library, its accelerator, its click, the stock View items kept, no second `CmdOrCtrl+B`), `electron-kit.test.ts` (the Library requests carried).

No model calls, so no row in `ai-costs.md`.
