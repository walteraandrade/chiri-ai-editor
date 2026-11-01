# 0013. Native app on Electron

- Status: Accepted (2026-10-31); amended by [0016](0016-web-and-electron-builds.md) (two builds) and by the Electron checks of 2026-11-01 (scheme, key)
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
  - Installed app: the main process serves the build on an `app://` scheme with `protocol.handle`, and forwards `/api/openrouter/*` to `https://openrouter.ai/api/v1`, overwriting `Authorization`.
  - The scheme is registered before `ready` with `protocol.registerSchemesAsPrivileged` as `standard`, `secure` and `supportFetchAPI`. `src/ai/browser-client.ts` builds its `baseURL` from `window.location.origin`. Checked with Electron 43.8.3: without `standard` the origin is `null` and `fetch` fails; with it the origin is `app://chiri`, and a streamed body from the handler arrives chunk by chunk, with or without the `stream` privilege.
- **Key in the installed app:** set in a settings screen and stored with `safeStorage`.
  - On Linux, Chromium picks the key store by desktop environment and does not know Hyprland. Checked with Electron 43.8.3 on the maintainer's machine, with `gnome-keyring-daemon` running: the backend was `basic_text`, `isEncryptionAvailable()` was false and `encryptString` threw. With `--password-store=gnome-libsecret` the backend was `gnome_libsecret` and encryption worked.
  - So the main process appends `password-store=gnome-libsecret` before `ready`, unless the command line already sets one. A fixed backend also keeps a stored key readable across reboots; Omarchy pins the same flag for its browsers for that reason.
  - If encryption is still not available, the settings screen says the key would be stored as plain text, like `.env` today, and stores it that way (`safeStorage.setUsePlainTextEncryption(true)`) only if the maintainer agrees. Otherwise the key lasts for the session.
- **Verification stays the same:** `agent-browser` attaches to the window over the Chrome DevTools Protocol (`--remote-debugging-port` in dev) and reads `window.__aiCalls` as before.
- **Two builds.** The browser app lives on as the Web build, frozen in features ([0016](0016-web-and-electron-builds.md)). This ADR covers the Electron build.

## Consequences

- The code that was tested keeps running on the same engine.
- The installed app is large (Electron ships Chromium, 100–200 MB) and uses more memory than a browser tab.
- Every preload function is an entry point to the disk. Each one validates its input in the main process.
- ADR 0005 stays true for the Web build and for Electron in dev; the installed app follows this ADR.
- `pnpm dev:electron` starts Electron; `pnpm dev` stays the Web build ([0016](0016-web-and-electron-builds.md)). `AGENTS.md` (stack, commands) changes in the first slice.
- The installed app is the one place the scheme and key checks above matter. Running from the repo with `pnpm dev:electron` needs neither.

## Alternatives considered

- **Tauri v2:** small binaries and a Rust backend, but it renders with the system webview, which is WebKitGTK on Linux. The app has never run there, and `agent-browser` cannot drive it over CDP.
- **Stay in the browser:** no packaging, but a folder pick per session, no watcher, and History limited to browser storage.
- **Local Node server plus a browser tab (`chromium --app=…` for a window):** full disk access and no packaging. But a localhost port that reads and writes skills answers every page the browser loads, so it needs a token and a `Host` check against DNS rebinding; there is no `safeStorage`, so the key stays in `.env`; and no native dialogs.
