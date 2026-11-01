# Issue #29 verification: Electron shell

Issue [#29](https://github.com/walteraandrade/chiri-ai-editor/issues/29), stacked on [PR #22](https://github.com/walteraandrade/chiri-ai-editor/pull/22). Checked on 2026-11-01 on the maintainer's Hyprland (Wayland), with `openai/gpt-6.1-terra` ([ADR 0010](../adr/0010-model-bakeoff.md)) through the Vite proxy, on the sample Document:

- **Electron build:** `CHIRI_DEV_PORT=5301 CHIRI_CDP_PORT=9301 CHIRI_USER_DATA_DIR=<temp dir> pnpm dev:electron`. Electron 43.8.6, Chrome 150, a 1896 x 1030 window.
- **Web build:** `CHIRI_DEV_PORT=5301 pnpm dev` in headless Chrome 148 (own profile, CDP on 9301), 1280 x 757.

```text
before  index.html → src/main.tsx → <App initialDoc hasApiKey onDocumentChange history />
after   index.html    → src/main.web.tsx      → createBrowserWebKit() ┐
        electron.html → src/main.electron.tsx → createBrowserWebKit() ┴→ mountApp(kit) → <App kit />
        electron/main     BrowserWindow (isolated, sandboxed), IPC handler, dev switches
        electron/preload  window.chiri.shellInfo()
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| `pnpm dev:electron` opens the app in a window on Hyprland (Wayland); `pnpm dev` still opens the browser app | Pass | `hyprctl clients`: class `chiri-ai-editor`, title `Chiri`, `xwayland: false`, so it runs on the Wayland backend with no Ozone flag. [29-1](img/29-1.png). `pnpm dev` served the same page at `http://localhost:5301/` and `agent-browser` attached to it |
| A Quick action and a Review pass work in the window and in the Web build | Pass | Window: Shorter on p5 gave a Suggestion with its Rationale and Accept / Reject / Refine ([29-2](img/29-2.png)); Accept replaced the paragraph; the Review pass then streamed Suggestions, with Accept all / Reject all and the cursor on the first one ([29-3](img/29-3.png)). Web build: the same steps ([29-4](img/29-4.png), [29-5](img/29-5.png)). All four calls valid on the first attempt |
| `agent-browser` attaches to the window over CDP and reads `window.__aiCalls` | Partly | `agent-browser connect 9301` attached to the window (`tab`: `Chiri - http://localhost:5301/electron.html`) and `snapshot`, `find`, `click`, `press` and `screenshot` drove it. The `Bash` guard of this isolated agent refused every command containing `eval`, so `agent-browser eval` was not run. `window.__aiCalls` was read with a small script that sends the same CDP `Runtime.evaluate` to port 9301 (table below). To be repeated with `agent-browser eval "JSON.stringify(window.__aiCalls)"` |
| The renderer has no `require`, `process` or other Node globals | Pass | `typeof` of `require`, `process`, `module`, `exports`, `global`, `Buffer`, `__dirname`, `ipcRenderer` and `electron` is `undefined`, in the dev window and in the built app. `Object.keys(window.chiri)` is `["shellInfo"]` |
| ADR 0013 records the build tool; `AGENTS.md` stack and commands are updated | Pass | [0013](../adr/0013-native-app-on-electron.md): electron-vite, why not Forge or vite-plugin-electron, Electron version, dev switches. `AGENTS.md`: stack row, commands, env vars, layout; the README commands |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; records and screenshots here, `ai-costs.md` updated | Pass | 898 tests in 64 files (35 new in 4 files); Biome clean; `pnpm build`: both `tsc` runs, then `dist/` and `out/` (the Web main chunk is 627.08 kB, 627.00 kB in the PR #26 record, and `browser-client` 477.18 kB, as there). No `sk-or-` string in `dist/` or `out/` |

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| The preload bridge works from a trusted frame | Pass | `await window.chiri.shellInfo()` returned `{ electron: "43.8.6", chrome: "150.0.7871.250", platform: "linux" }`. The handler checks `event.senderFrame.origin` against `http://localhost:5301` |
| New windows and navigation are locked | Pass | `window.open('https://example.com/')` returned `null` and opened nothing; `location.href = 'https://example.com/'` left the page on `http://localhost:5301/electron.html`; a `#hash` change on the same document still worked |
| File System Access works in the window | Pass | Open called `showOpenFilePicker`; the GTK portal's "Open File" dialog (`xdg-desktop-portal-gtk`) appeared and was closed by hand, nothing was opened. Save and `createWritable` were not exercised |
| `CHIRI_USER_DATA_DIR`, `CHIRI_CDP_PORT`, `CHIRI_DEV_PORT` | Pass | The window wrote its data only to the temp `userData` (`~/.config` has no `chiri` folder), the DevTools port answered on 9301 (`/json/version`: `Electron/43.8.6`) and Vite listened on 5301 only. All three closed with the window |
| The production bundle starts | Pass | `pnpm preview:electron` with `--remote-debugging-port=9301 --user-data-dir=<temp>` passed by hand: the window loaded `file:///…/out/renderer/electron.html`, the same `typeof` results, and `shellInfo()` worked from `file://` (frame origin `file://`). `window.__aiCalls` is not defined there (dev only) and AI calls were not tried ([ADR 0013](../adr/0013-native-app-on-electron.md)). The 9301 port in this check came from the flag, not from the app |

Not checked: Save in the window, `Ctrl+Z` after Accept in the window (CDP key events skip the native menu, so they cannot show a clash with its accelerators), and a Review pass from the built app.

## AI calls during verification

Read from `window.__aiCalls`. `openai/gpt-6.1-terra` was served by OpenAI as `gpt-6.1-terra-20261026` in all four. Latencies are client total / OpenRouter `latency` / `generation_time`, in ms.

| Build | Task | Tokens in / out / reasoning / cached | Cost (US$) | Latency | Finish | Valid | Generation id |
|---|---|---|---|---|---|---|---|
| Electron | cursor in p5 → Shorter | 529 / 60 / 0 / 0 | 0.000829 | 3278 / 1630 / 2169 | stop | 1/1, no retry | `gen-1793533958-Ux3USA7k4oEvvMLIOiO5` |
| Electron | review document → default criteria | 955 / 316 / 0 / 0 | 0.002535 | 5069 / 1333 / 4791 (first element 2743, first Suggestion 2744) | stop | 1/1, no retry | `gen-1793534000-gmL3zimrb0HS9lDpPob0` |
| Web | cursor in p5 → Shorter | 529 / 59 / 0 / 0 | 0.000824 | 2885 / 1651 / 2296 | stop | 1/1, no retry | `gen-1793534165-UQ2RfqFuPBcNpa6vnPPz` |
| Web | review document → default criteria | 954 / 317 / 0 / 0 | 0.002539 | 4762 / 982 / 4562 (first element 2460, first Suggestion 2461) | stop | 1/1, no retry | `gen-1793534178-CGCke9zvOZeqj7OluNOF` |

Total US$0.006727. The Web build's log was lost when an edit to a source file made Vite reload the page, after the Review pass had been read once without its OpenRouter fields; those two come from `GET /api/openrouter/generation?id=…` through the dev proxy. The key was never printed.

## Decisions worth a look in review

- **The kit holds what `App` took as four props** (`unsavedText`, `history`, `keyStatus`) and nothing else. `DocumentFiles` and the optional Electron features are fields to add later; `useMarkdownFile` still builds the browser file adapter inside, until the next slice moves it behind the kit.
- **Electron's preload is CJS (`out/preload/index.cjs`)** although the package is `"type": "module"`: electron-vite's default would be an ESM `.mjs`, which a sandboxed renderer cannot load.
- **`shellInfo` has no caller in the UI.** It exists to prove the bridge, the sender check and the typing pattern that later slices copy; the Electron entry uses the Web kit, as the issue says.
- **The DevTools port opens by default (9222) in dev.** The issue asks for a port in dev; `CHIRI_CDP_PORT` moves it. It is gated on `ELECTRON_RENDERER_URL`, which only `electron-vite dev` sets.
