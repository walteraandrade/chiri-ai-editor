# 0013. Native app on Electron

- Status: Accepted (2026-10-31); amended by [0016](0016-web-and-electron-builds.md) (two builds), by the Electron checks of 2026-11-01 (scheme, key) by the first slice (#29: build tool, Electron version) and by the installed-app slice (#35: the `app://` handler, the key store, the package)
- Source: maintainer request after the submission: turn Chiri into a native editor for their agent skills, on top of PR #22. Electron was the maintainer's proposal; the review weighed it against Tauri and staying in the browser.

## Context

A skills editor reads and writes folders the browser cannot reach freely: `~/.claude/skills`, `~/.agents/skills`, a project's `.claude/skills`. The File System Access API ([0011](0011-open-and-save-markdown-files.md)) opens one file per pick, asks for permission again after a reload, and cannot watch for changes. The maintainer runs Linux (Omarchy, Hyprland). The app has only ever been checked in Chromium, through `agent-browser`.

## Decision

- **Electron, Linux first.** The renderer is the current React app, bundled by Vite as today. The main and preload builds join the Vite setup through **electron-vite** (see Build tool below).
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
- **Installed app (#35):**
  - **One URL rule.** A packaged app always loads `app://chiri/electron.html` and ignores `ELECTRON_RENDERER_URL`. An unpackaged run loads the Vite dev server when `electron-vite dev` sets that variable, and the built bundle on `app://` otherwise, so `pnpm preview:electron` serves the same way the package does and `file://` is no longer used ([security checklist](https://www.electronjs.org/docs/latest/tutorial/security) item 18). `URL.origin` is `"null"` for a non-special scheme, so the trust checks compare scheme and host.
  - **The handler** serves files from `out/renderer` (decoded path kept inside the folder, a content type per extension, a CSP and `nosniff` on every response) and forwards `/api/openrouter/*`. The forwarder is a table, not a prefix: `POST /chat/completions` and `GET /generation`, nothing else, so a compromised renderer cannot reach `/key` or `/credits` with the key. It sends only `content-type` and `accept`, overwrites `Authorization`, refuses redirects, aborts the upstream request when the renderer cancels the response body (the request that Electron 43 hands to `protocol.handle` carries no signal that fires, so Stop and a reload would otherwise leave the stream running and billed), and returns only `content-type` and `retry-after` (a `Content-Encoding` header would make the renderer decode a body Chromium already decoded). Without a key it answers 401 in OpenRouter's error shape. A request whose `initiatorOrigin` is not the app origin gets 403.
  - **The key store** keeps one file, `userData/openrouter-key.json` (mode 0600): `{version, storage: "keyring" | "plain-text", data}` with `data` the `safeStorage` ciphertext in base64. `chooseKeyStorage` counts `basic_text` and `unknown` as not protected even when `isEncryptionAvailable()` is true. Saving without a protected backend keeps the key in memory for the session; the screen then offers "Store as plain text", the only path to `setUsePlainTextEncryption(true)`. An unreadable file (keyring locked or gone, corrupt) is reported and left alone: saving a key while the keyring is unavailable keeps it for the session and never deletes a `keyring` file; only Remove key does.
  - **The key crosses IPC once**, from the settings form to `saveKey`, which validates it in the main process (visible ASCII, at most 512 characters). Every answer carries a status, never the key. In a dev run the Vite proxy holds the key, so the key functions answer `managed: false` and refuse to change anything.
  - **Electron's `safeStorage` synchronous API** (`isEncryptionAvailable`, `encryptString`, `decryptString`) is what 43 offers and what the checks above used; the docs mark it deprecated since 45.0.0 and removed in 46. Moving to 45 means `encryptStringAsync` and `decryptStringAsync`, behind the same `SafeStorageLike` port, and a re-run of the backend check.
  - **Hardening applied** from the checklist: CSP in the response headers (7), permission request, check and device handlers that refuse everything (5), `will-attach-webview` denied (11, 12), custom scheme instead of `file://` (18), fuses (19: `RunAsNode`, `NODE_OPTIONS`, `--inspect`, `file://` privileges off, `OnlyLoadAppFromAsar` on; cookie encryption off because no cookies are used; embedded ASAR integrity is not supported on Linux). Sender validation and navigation locks come from #29.
  - **The package** is built by electron-builder (`electron-builder.yml`): a `.pacman` for Omarchy, `app.asar` with `out/` only. `electron-vite` bundles the main and preload dependencies (`externalizeDeps: false`), and `pnpm check:externals` fails the package when `out/main` or `out/preload` still import anything but `electron` and Node, because the package ships no `node_modules`.
- **Build tool: electron-vite 6** (picked in #29, from its docs and source; Vite 8 is in its peer range). One `electron.vite.config.ts` holds three builds.
  - `main`: ESM (`"type": "module"`), `electron/main/index.ts` to `out/main/index.js`.
  - `preload`: forced to CJS and `.cjs`, `electron/preload/index.ts` to `out/preload/index.cjs`. electron-vite's default under `"type": "module"` is an ESM `.mjs` preload, which a sandboxed renderer cannot load ([Electron ESM](https://www.electronjs.org/docs/latest/tutorial/esm)).
  - `renderer`: `root: '.'`, entry `electron.html` to `out/renderer/electron.html`, with the same `rendererConfig` (React and Tailwind plugins, `__HAS_OPENROUTER_KEY__`, `__OPENROUTER_MODEL__`, the OpenRouter proxy table) that `vite.config.ts` uses for the Web build, so the two renderers cannot drift. electron-vite does not minify the renderer by default.
  - `electron-vite dev` builds main and preload, starts the renderer dev server, sets `ELECTRON_RENDERER_URL` and starts Electron with `package.json`'s `main`. Main and preload rebuild on change only with `--watch`.
  - `pnpm build` type-checks both tsconfigs, then runs the Web build (`dist/`) and the Electron build (`out/`).
- **Electron 43** (`^43.8.6`; the scheme and key checks above ran on 43.8.3). Newer majors (45 at the time of writing) are a bump plus a re-run of those checks, in the installed-app slice. pnpm 11 needs `allowBuilds: electron: true` in `pnpm-workspace.yaml`, or every `pnpm` command fails with `ERR_PNPM_IGNORED_BUILDS` after the install; the binary then downloads into `~/.cache/electron`.
- **Dev switches**, read in the main process of an unpackaged run (`pnpm dev:electron`, `pnpm preview:electron`); the debugging port only when `ELECTRON_RENDERER_URL` is set, so the built app opens none:
  - `CHIRI_CDP_PORT`: the Chrome DevTools port, default 9222 (dev run only).
  - `CHIRI_USER_DATA_DIR`: an absolute path for Electron's `userData`. It also applies to `pnpm preview:electron`, which is not packaged; a packaged app ignores it.
  - `CHIRI_DEV_PORT` sets the Vite port for `pnpm dev` and `pnpm dev:electron`; when set, Vite does not move to another port.
  - `CHIRI_DEV_PICK_FILE`: an absolute path of a text file; only with `ELECTRON_RENDERER_URL` set and an unpackaged app. Open, Save as and the Library's Add skip the native dialog and use the path in that file (a folder, for Add), read at each dialog. Added in the file slice (#30) for checks, because `agent-browser` cannot confirm a GTK dialog.
- **Window and IPC rules from the first slice:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; new windows denied; navigation away from the app origin cancelled; every IPC handler checks `event.senderFrame.origin` against the app origin ([Electron security](https://www.electronjs.org/docs/latest/tutorial/security), items 13, 14 and 17). The preload exposes `window.chiri.shellInfo()` only.
- **Verification stays the same:** `agent-browser` attaches to the window over the Chrome DevTools Protocol (`--remote-debugging-port` in dev) and reads `window.__aiCalls` as before.
- **Two builds.** The browser app lives on as the Web build, frozen in features ([0016](0016-web-and-electron-builds.md)). This ADR covers the Electron build.

## Consequences

- The code that was tested keeps running on the same engine.
- The installed app is large (Electron ships Chromium, 100–200 MB) and uses more memory than a browser tab.
- Every preload function is an entry point to the disk. Each one validates its input in the main process.
- ADR 0005 stays true for the Web build and for Electron in dev; the installed app follows this ADR.
- `pnpm dev:electron` starts Electron; `pnpm dev` stays the Web build ([0016](0016-web-and-electron-builds.md)). `AGENTS.md` (stack, commands) changed in the first slice.
- `pnpm preview:electron` runs the built app on `app://`, like the package. The installed-app slice added the scheme, the forwarder, the CSP, the permission handlers and the fuses ([Electron security](https://www.electronjs.org/docs/latest/tutorial/security), items 5, 7, 18 and 19).
- The installed app is the one place the scheme and key checks above matter. Running from the repo with `pnpm dev:electron` needs neither.

## Alternatives considered

- **Tauri v2:** small binaries and a Rust backend, but it renders with the system webview, which is WebKitGTK on Linux. The app has never run there, and `agent-browser` cannot drive it over CDP.
- **Stay in the browser:** no packaging, but a folder pick per session, no watcher, and History limited to browser storage.
- **Electron Forge with its Vite plugin (build tool):** it also packages. But its docs mark the Vite plugin experimental since Forge 7.5.0, and it wants one Vite config per target and its own start command, so the Web and Electron renderers would be configured twice. Packaging is the optional last slice, and Forge's makers or electron-builder can be added then.
- **vite-plugin-electron (build tool):** a plugin inside `vite.config.ts`, so `pnpm dev` would have to turn it off to stay the Web build. Its default for `"type": "module"` is an ESM `.mjs` preload, and its default launch arguments include `--no-sandbox`; both would be overridden. It does not package either.
- **Local Node server plus a browser tab (`chromium --app=…` for a window):** full disk access and no packaging. But a localhost port that reads and writes skills answers every page the browser loads, so it needs a token and a `Host` check against DNS rebinding; there is no `safeStorage`, so the key stays in `.env`; and no native dialogs.
