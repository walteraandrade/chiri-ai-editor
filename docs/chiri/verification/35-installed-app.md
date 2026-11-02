# Issue #35 verification: Installed app

Issue [#35](https://github.com/walteraandrade/chiri-ai-editor/issues/35), stacked on [#29](https://github.com/walteraandrade/chiri-ai-editor/issues/29)'s branch while the slices below it land. **Phase 1 record:** checked on 2026-11-01 on `feat/electron-shell` plus this slice, before the rebase onto `feat/skill-checks`; the checks are repeated after it. Electron 43.8.6 (Chrome 150), every run inside a headless `gamescope` (X11, 1440 x 900, nothing on the Hyprland screen), a throwaway `userData` per run, and the dummy key `sk-or-v1-dummy-for-tests` only. The real key was never typed, pasted or read. No model call was billed (OpenRouter answered 401 to the dummy key), so [ai-costs.md](../ai-costs.md) has no new row.

```text
renderer  fetch('/api/openrouter/chat/completions')        origin app://chiri
   │
main      protocol.handle('app')  ── files from out/renderer (CSP, nosniff, path kept inside the folder)
          └─ /api/openrouter/*  ── table: POST /chat/completions, GET /generation
             Authorization := key held by the key store; the key never leaves this process
             └─ net.fetch → https://openrouter.ai/api/v1/…   (redirects refused; cancelling the response body aborts the upstream request)
key store userData/openrouter-key.json (0600) = safeStorage ciphertext
          keyring (gnome_libsecret) │ plain text (only after "Store as plain text") │ session (memory)
preload   window.chiri.keyState / saveKey / keepKeyAsPlainText / clearKey   (status only, never the key)
```

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| TDD covers the forwarding (path mapping, `Authorization` overwritten, no key in the response) and the key-store choice | Pass | `openrouter-forward.test.ts` (23: the route table, traversal and look-alike paths, `Authorization` overwritten and the placeholder dropped, cookies, origin and referer dropped, response headers cut to `content-type` and `retry-after`, 401 without a key, 404 outside the table, 502 without the key in the body, the upstream request aborted when the response body is cancelled), `key-store.test.ts` (26: `chooseKeyStorage`, save, plain text, load, unreadable file, a keyring file kept when the keyring is unavailable, clear), `app-url.test.ts` (packaged vs dev URL), `app-protocol.test.ts`, `static-files.test.ts`, `key-ipc.test.ts`, `key-input.test.ts`, `password-store.test.ts`, `security.test.ts`, `key-file.test.ts`, `externals.test.ts`, plus `key-settings.test.ts` and `key-status.test.ts` in the renderer. Red first for `trust.ts` (the origin of `app://` is `"null"` in the URL API) and for the key store (module missing); the other modules were written right after their tests, without a separate red run |
| The installed app runs a Review pass with no `.env` and no dev server, and its Suggestions stream one by one | **Manual** | The scripts below ran with no `.env` and no Vite. A Review pass with the dummy key reached OpenRouter through the forwarder and came back as `401 User not found` ([35-3](img/35-3.png)); with no key the app's own `401 OpenRouter key missing` showed instead, so the header was set by the forwarder. Streaming was checked without the real key: a throwaway Electron script served a page on `app://` with the same `net.fetch` pattern against a local SSE server. A 200 KB POST body arrived upstream whole, `Authorization` was the one the main process set, and the four events reached the page at 553, 944, 1345 and 1747 ms, one by one. The Review pass with the real key is the maintainer's check: steps below |
| `safeStorage.getSelectedStorageBackend()` returns `gnome_libsecret` on Hyprland | Pass | After Save key the screen read "Stored in the system keyring (gnome_libsecret)." ([35-2](img/35-2.png), [35-5](img/35-5.png)); that sentence is built from the backend the main process reads. Inside gamescope, with `XDG_CURRENT_DESKTOP=Hyprland` unchanged and no `password-store` on the command line, so the app's own `gnome-libsecret` switch was in effect. The packaged app read the key back from the keyring after a relaunch. `--password-store=basic` on the command line wins over the app's default, as the issue asks (below) |
| The key never reaches the renderer (not on `window`, not in any response) | Partly | By construction and by test: the preload has five functions and all of them answer with a status (`present`, `storage`, `keyringAvailable`, `backend`, `unreadable`, `managed`); `key-ipc.test.ts` and `key-store.test.ts` check that no status contains the key; `app-protocol.test.ts` and `openrouter-forward.test.ts` check that no response header or body does; `grep sk-or` over `dist/` and `out/` finds nothing; the stored file does not contain the dummy string. The key does cross IPC once, from the form to `saveKey`, which is the one way a typed key can reach the main process. **Not run:** reading `window` in the page. The permission guard of this agent refused every `agent-browser eval`, and no other way of evaluating code in the page was used. Manual step below |
| The desktop entry launches the app on Hyprland (Wayland) | **Manual** | The package's desktop entry was launched with `gio launch` (a copy with an absolute `Exec` and `--user-data-dir`, nothing installed) inside gamescope: the window loaded `app://chiri/electron.html`, the stored key was read back and a Review pass answered 401. Native Wayland is the maintainer's check. One run before the headless rule showed `hyprctl clients`: class `chiri-ai-editor`, `xwayland: false` |
| `pnpm test`, `pnpm biome check` and `pnpm build` green; records and screenshots here, `ai-costs.md` updated | Pass, no model call | 1040 tests in 78 files (911 in 65 before; 129 new); Biome clean; `pnpm build` (both `tsc` runs, `dist/`, `out/`) green. No model call was billed, so no cost row |

## Checks beyond the criteria

| Check | Result | Evidence |
|---|---|---|
| The packaged app ignores `ELECTRON_RENDERER_URL` | Pass | The packaged binary started with `ELECTRON_RENDERER_URL=http://localhost:1` and loaded `app://chiri/electron.html` (DevTools `/json`). `app-url.test.ts` covers the rule. (Run on a visible window, before the headless rule.) |
| Missing key | Pass | Banner "OpenRouter key missing. Set the key" ([35-1](img/35-1.png)); Review answered `401 OpenRouter key missing. Add it with the Key button.`; Remove key deleted `openrouter-key.json` |
| Keyring path | Pass | `openrouter-key.json` is `{"version":1,"storage":"keyring","data":"<base64>"}`, mode 0600, with no key text in it. If the keyring is locked or not up when the app starts, the screen says "The system keyring is not available, so the stored key cannot be read. Unlock your keyring and restart Chiri."; entering a key then keeps it for the session and leaves the keyring file alone (`key-store.test.ts`). Only Remove key deletes it |
| No keyring (`--password-store=basic`) | Pass | The command line's `password-store` is kept. Saving gave "Kept for this session only. Quitting forgets it." and wrote nothing; the screen offered "Store as plain text" with the `.env` comparison ([35-4](img/35-4.png)); the click wrote `{"storage":"plain-text",…}` (mode 0600) and a restart read it back ("Stored as plain text on this machine, like .env.") |
| Packaged app | Pass | `pnpm package`: `release/chiri-ai-editor-0.0.0.pacman`, 122,752,136 bytes (117 MiB; 318 MiB installed), `app.asar` 2.6 MB with `out/` and `package.json` only. Desktop entry: `Name=Chiri`, `Exec=/opt/Chiri/chiri-ai-editor %U`, `Icon=chiri-ai-editor`, `StartupWMClass=chiri-ai-editor`, `Categories=Utility;TextEditor;`. Depends on gtk3, nss, libsecret, xdg-utils, at-spi2-core, libxss, libxtst and libnotify. A packaged app takes `--user-data-dir=<dir>` (`CHIRI_USER_DATA_DIR` is ignored): `~/.config` stayed free of a `chiri-ai-editor` folder |
| Fuses | Pass | `electron-fuses read`: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`, `GrantFileProtocolExtraPrivileges` and cookie encryption off, `OnlyLoadAppFromAsar` on. `EnableEmbeddedAsarIntegrityValidation` is not supported on Linux, so it stays off |
| Runtime externals | Pass | `pnpm check:externals` (part of `pnpm package`): `out/main` and `out/preload` import only `electron` and Node. electron-vite bundles dependencies (`externalizeDeps: false`) because the package ships no `node_modules`. Checked both ways: with `zod` imported in the main process and externalized the check fails; bundled it passes |
| Cancelling a pass stops the upstream stream | Pass | Electron 43's `protocol.handle` request has no signal that fires, so the forwarder wraps the upstream body in a stream whose `cancel` aborts the `net.fetch`. Checked in the built app inside gamescope against a local HTTPS mock that sends one SSE chunk every 400 ms and logs when its connection closes (`--host-resolver-rules="MAP openrouter.ai 127.0.0.1:8443" --ignore-certificate-errors` on the command line, nothing in the app's config; a self-signed certificate; the dummy key). A Review pass reached the mock with `Authorization` present and a 4837-byte body; **Stop** in the UI after about 8 s of streaming and the mock logged `CLOSED by client after 19 chunks` within a second of the click. A second pass was reloaded mid-stream (`agent-browser reload`) and the mock logged the close at once (10 chunks). Without the stop or reload the mock would have run 150 chunks (60 s) |
| Keyring entry | Noted | One entry, label `Chromium Safe Storage`, attribute `application = chiri-ai-editor`, created on the first `safeStorage` use of the first run. The packaged app reused it |

## Hardening applied ([Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security))

| Item | What |
|---|---|
| 5 Permission requests | `setPermissionRequestHandler`, `setPermissionCheckHandler` and `setDevicePermissionHandler` refuse everything |
| 7 CSP | In the headers of every `app://` response: `default-src 'none'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (CodeMirror and React write inline styles), `img-src` and `font-src` `'self' data:`, `connect-src 'self'`, `object-src`, `base-uri`, `form-action` and `frame-ancestors` closed. No console message or page error appeared with it on |
| 11, 12 Webviews | `will-attach-webview` is cancelled |
| 13, 14, 17 | Unchanged from #29; the trust checks now compare scheme and host, because `URL.origin` is `"null"` for a custom scheme |
| 18 `file://` | The built app, in a package or from `pnpm preview:electron`, loads from `app://`; `file://` is no longer used |
| 19 Fuses | As above |

Not applied: the `fileSystem` permission is refused too. The Electron build still opens and saves through the File System Access API on this branch; slice #30 moves that to the main process. If Save fails after the rebase, look here first.

## For the maintainer: manual checks

Do these on your own session; nothing here was run on your screen. Replace `<repo>` with this checkout.

1. **Build and install.** `pnpm install && pnpm package` writes `release/chiri-ai-editor-0.0.0.pacman`. Install with `sudo pacman -U release/chiri-ai-editor-0.0.0.pacman`. It puts the app in `/opt/Chiri`, a launcher entry named Chiri, a `chiri-ai-editor` command in `/usr/bin` and an icon. Remove with `sudo pacman -R chiri-ai-editor`. The app needs a Secret Service provider (`gnome-keyring`, already running on Omarchy).
2. **Desktop entry on Wayland.** Start Chiri from the launcher (not from a terminal). Then `hyprctl clients -j | jq '.[] | select(.class=="chiri-ai-editor") | {class, title, xwayland}'` should show `xwayland: false`.
3. **No repo, no `.env`, no dev server.** Make sure `pnpm dev` and `pnpm dev:electron` are not running (`ss -ltn | grep -E ':(5173|5301)'` shows nothing). The window opens with the banner "OpenRouter key missing".
4. **Key.** Press "Set the key" (or the Key button), paste your OpenRouter key into the password field, Save key. The screen says "Stored in the system keyring (gnome_libsecret)." Quit and start the app again: the banner is gone and the Key screen still says so.
5. **Review pass.** Press Review. Suggestions appear one by one while the pass runs; Accept and Reject work. The installed app does not record `window.__aiCalls` (dev only), so take the cost of the call from the OpenRouter activity page and add a row to [ai-costs.md](../ai-costs.md).
6. **The key never reaches the page.** Start `chiri-ai-editor --remote-debugging-port=9333` and run `agent-browser connect 9333`, then `agent-browser eval "Object.keys(window.chiri)"` (expect `shellInfo`, `keyState`, `saveKey`, `keepKeyAsPlainText`, `clearKey`) and `agent-browser eval "JSON.stringify(await window.chiri.keyState())"` (expect no key, only status fields). The same flag works for any packaged run.
7. **Keyring entry.** The app's entry in the login keyring is labelled `Chromium Safe Storage` with attribute `application = chiri-ai-editor`. Remove it with `secret-tool clear xdg:schema chrome_libsecret_os_crypt_password_v2 application chiri-ai-editor`. Its data folder is `~/.config/chiri-ai-editor/`.

## Decisions worth a look in review

- **The forwarder is a table of two routes**, not a prefix. A later feature that needs another OpenRouter endpoint (a model list for the selector in the backlog) adds a line to `ROUTES` in `openrouter-forward.ts`.
- **`pnpm preview:electron` now serves `app://`**, so it exercises the forwarder and the key screen without packaging. It opens no DevTools port; pass `--remote-debugging-port=<port>` to attach.
- **Plain text is a second, explicit step.** Saving never writes plain text; only the "Store as plain text" button does. `electron/main/key-store.ts` counts `basic_text` as unprotected even when `isEncryptionAvailable()` is true.
- **`safeStorage`'s synchronous API** is deprecated from Electron 45 and removed in 46 ([ADR 0013](../adr/0013-native-app-on-electron.md)).
- **`electron/main/trust.ts` changed:** `isAppNavigation` compared `URL.origin`, which is `"null"` for every non-special scheme, so `data:` and `app://other` passed for `app://chiri`.
