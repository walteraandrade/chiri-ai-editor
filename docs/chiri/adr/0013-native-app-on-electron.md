# 0013. Native app on Electron

- Status: Accepted (2026-10-31)
- Source: maintainer request after the submission: turn Chiri into a native editor for their agent skills, on top of PR #22. Electron was the maintainer's proposal; the review weighed it against Tauri and staying in the browser.

## Context

A skills editor reads and writes folders the browser cannot reach freely: `~/.claude/skills`, `~/.agents/skills`, a project's `.claude/skills`. The File System Access API ([0011](0011-open-and-save-markdown-files.md)) opens one file per pick, asks for permission again after a reload, and cannot watch for changes. The maintainer runs Linux (Omarchy, Hyprland). The app has only ever been checked in Chromium, through `agent-browser`.

## Decision

- **Electron, Linux first.** The renderer is the current React app, bundled by Vite as today. The main and preload builds join the Vite setup; the tool (electron-vite, a Vite plugin or Electron Forge) is picked in the first slice.
- **Three parts:**
  - Main process: disk, file watcher, History database ([0015](0015-history-in-sqlite.md)), the OpenRouter key.
  - Preload: a small typed API through `contextBridge`. One function per action; no generic `invoke` passthrough.
  - Renderer: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. It never sees the key or a raw `fs`.
- **AI calls keep their URL.** The renderer still calls `/api/openrouter/*`.
  - Dev: the window loads the Vite dev server, so the Vite proxy ([0005](0005-local-only-vite-proxy.md)) works unchanged.
  - Installed app: the main process serves the build on an `app://` scheme with `protocol.handle`, and forwards `/api/openrouter/*` to `https://openrouter.ai/api/v1`, overwriting `Authorization`. Streaming through the handler is checked in that slice.
- **Key in the installed app:** set in a settings screen and stored with `safeStorage`. On Linux it needs a secret service (GNOME Keyring, KWallet). If Electron falls back to its `basic_text` backend, the settings screen says the key is stored weakly.
- **Verification stays the same:** `agent-browser` attaches to the window over the Chrome DevTools Protocol (`--remote-debugging-port` in dev) and reads `window.__aiCalls` as before.
- **One target.** This line drops plain browsers: the Firefox and Safari fallbacks and the File System Access path go once the main process handles files. `main` keeps the browser app as submitted.

## Consequences

- The code that was tested keeps running on the same engine.
- The installed app is large (Electron ships Chromium, 100–200 MB) and uses more memory than a browser tab.
- Every preload function is an entry point to the disk. Each one validates its input in the main process.
- ADR 0005 stays true for dev only; the installed app follows this ADR.
- `pnpm dev` starts Electron. `AGENTS.md` (stack, commands) changes in the first slice.

## Alternatives considered

- **Tauri v2:** small binaries and a Rust backend, but it renders with the system webview, which is WebKitGTK on Linux. The app has never run there, and `agent-browser` cannot drive it over CDP.
- **Stay in the browser:** no packaging, but a folder pick per session, no watcher, and History limited to browser storage.
- **Local Node server plus a browser tab:** full disk access, but two processes, a port open on localhost, and no app window.
