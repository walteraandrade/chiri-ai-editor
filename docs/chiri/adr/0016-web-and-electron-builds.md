# 0016. Web and Electron builds

- Status: Accepted (2026-11-01)
- Source: maintainer question after reviewing 0013 to 0015 ("can we have both builds?").
- Amends: [0013](0013-native-app-on-electron.md) (one target), [0011](0011-open-and-save-markdown-files.md) and [0012](0012-document-history.md) (now Web build only), [0014](0014-skills-on-disk.md) and [0015](0015-history-in-sqlite.md) (Electron build only)

## Context

[0013](0013-native-app-on-electron.md) made Electron the only target: the File System Access path, the Firefox and Safari fallbacks and the `localStorage` Document were to go, while "`main` keeps the browser app". But the native slices land in `feat/open-save-markdown`, and [PR #22](https://github.com/walteraandrade/chiri-ai-editor/pull/22) squash-merges that branch into `main`. Merging it would turn `main` into an Electron-only app.

The browser-only code is small and already behind seams: `src/document/browser-files.ts` (pickers and fallbacks), `src/document/storage.ts` (`localStorage` for the Document and History), the wiring in `src/ui/use-markdown-file.ts` and the composition in `src/main.tsx`. `FileSession<H>` is already generic over the file reference.

## Decision

- **Two builds, one renderer.**
  - **Web build:** a browser tab on the Vite dev server, as submitted. `pnpm dev`.
  - **Electron build:** the Electron window ([0013](0013-native-app-on-electron.md)). `pnpm dev:electron`.
- **A platform kit per build** (Abstract Factory). Each entry, `src/main.web.tsx` and `src/main.electron.tsx`, builds one kit through an async factory (`() => Promise<PlatformKit>`, `src/platform/start.ts`) and passes it to `App` once it resolves. A kit holds the adapters that must match each other:
  - `DocumentFiles<Ref>`: open, save, save as. Web: File System Access plus fallbacks ([0011](0011-open-and-save-markdown-files.md)). Electron: the preload API, `Ref` is the real path ([0014](0014-skills-on-disk.md)).
  - History store: list Versions, append a Version, mark one saved, load a text. Web: `localStorage` as in [0012](0012-document-history.md). Electron: `history.sqlite` ([0015](0015-history-in-sqlite.md)).
  - Unsaved text: Web: the `chiri.document` autosave. Electron: per file.
  - Key status: Web: `__HAS_OPENROUTER_KEY__`. Electron: asked from the main process.
  - Electron-only features (Library, watcher, key settings) are optional fields; the UI shows them only when the kit has them.
- **The Web build is frozen in features.** It gets every change to shared code (Suggestions, diff, prompts, Blocks, the frontmatter rule, frontmatter checks). It gets no new platform feature.
- **`DocumentFiles` returns results as values:** saved, conflict (the disk changed since the last read), cancelled or failed. `FileHost` keeps its meaning, the browser picker API, and lives inside the Web adapter. `createFileActions` becomes generic over `Ref`; the picker lock moves into the Web adapter.
- **The History store is async in both builds.** The Web adapter answers from `localStorage` through promises, so the Timeline and Full history know one interface.
- **Branches:** slices keep branching from `feat/open-save-markdown`. PR #22 can squash-merge into `main` when it reopens: `main` then has both builds, and `pnpm dev` still opens the browser app.
- **Checks:** a slice that touches shared code or the Web kit is checked in both builds; an Electron-only slice in the Electron build. Both run Chromium, so `agent-browser` drives both. Each slice's issue says which builds it touches.

## Consequences

- `main` never loses the browser app, and fixes to shared code reach both builds without cherry-picks.
- Every port has two adapters, each with its own tests.
- The Web History store pays for promises it does not need. The Timeline and Full history move to async reads in both builds, which [0015](0015-history-in-sqlite.md) required anyway.
- The Electron bundle does not ship the browser fallbacks, and the Web bundle does not ship preload calls: separate entries.
- The Web build still runs only with the dev server, since the key lives behind the Vite proxy ([0005](0005-local-only-vite-proxy.md)).
- The maintainer's daily command is `pnpm dev:electron`; `pnpm dev`, the README and the assessment instructions stay as they are.

## Alternatives considered

- **Electron only (0013 as written):** less code. But PR #22 cannot merge into `main` without deleting the browser app.
- **Two lines (PR #22 frozen, a new branch for native):** no ports to build now. But every fix to shared code is cherry-picked between lines for good, and they drift.
- **One bundle, platform found at run time (`window.chiri` present or not):** one build to run. But each app ships the other's code, and every kit field becomes optional in the types.
- **`DocumentFiles` shaped like File System Access, with Electron faking handles:** `file-actions.ts` stays as it is. But the check before Save and the atomic rename hide inside `createWritable().close()` and come back as thrown errors, and the Library opens files by path with no picker, so it needs a side door anyway.
