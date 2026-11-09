# AGENTS.md

Browser Markdown editor with an AI co-author. The AI proposes inline, reviewable suggestions; the user accepts, rejects, or refines them.

## Read first

1. [GLOSSARY.md](GLOSSARY.md) — use these names in code, UI, PRs and issues.
2. [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) — before any UI, color or motion change.
3. [docs/PLAN.md](docs/PLAN.md) — roles and the per-slice loop.
4. The GitHub issue you are working on, and every ADR it links in [docs/adr/](docs/adr/).

ADRs are decisions, not suggestions. If an ADR blocks you, stop and report it; do not work around it.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node 22+ (required by `ai@7`) |
| Package manager | pnpm (pin with `packageManager` in `package.json`) |
| App | Vite + React + TypeScript (strict) |
| Desktop shell | Electron 43 built with `electron-vite` ([ADR 0013](docs/adr/0013-native-app-on-electron.md)); two builds, Web and Electron ([ADR 0016](docs/adr/0016-web-and-electron-builds.md)) |
| Editor | CodeMirror 6, `@codemirror/lang-markdown` |
| Styling | Tailwind v4, theme tokens in CSS via `@theme`, aliases of a theme's solid roles, with no `color-mix()`, alpha colors or shadows ([DESIGN.md](DESIGN.md), [ADR 0017](docs/adr/0017-book-themes-and-solid-colors.md)); themes picked in Preferences; dark Mood Indigo by default, the Omarchy theme (light or dark) in dev when present; sans-serif; League Spartan for the app title |
| AI | `ai@^7` + `@openrouter/ai-sdk-provider@^3` + `zod` |
| Diff | `diff` (jsdiff) |
| Tests | Vitest |
| Lint/format | Biome |

Commands:

| Command | What it does |
|---|---|
| `pnpm dev` | Web build: the browser app on the Vite dev server. |
| `pnpm dev:electron` | Electron build: the window on the Vite dev server (proxy included), with a Chrome DevTools port for `agent-browser`. |
| `pnpm test` | Vitest. |
| `pnpm biome check` | Lint and format. |
| `pnpm build` | Type-check (both tsconfigs), then the Web build (`dist/`) and the Electron build (`out/`). `build:web` and `build:electron` run each alone. |
| `pnpm preview:electron` | Runs the built Electron app from `out/` on the `app://` scheme, with the main-process OpenRouter forwarder and the key settings screen (no `.env`, no Vite). Honors `DESAFINADO_USER_DATA_DIR`; opens no DevTools port (pass `--remote-debugging-port=<port>` after the command to attach). |
| `pnpm package` | Builds `out/`, checks that `out/main` and `out/preload` import nothing outside `electron` and Node, then packages for Linux with electron-builder (`release/desafinado-<version>.pacman`). `package:dir` stops at the unpacked app in `release/linux-unpacked/`. |
| `pnpm bakeoff` | Model Bake-off. Calls the model. |

Dev environment variables (all optional; parallel checkouts on one machine need their own):

| Variable | Effect |
|---|---|
| `DESAFINADO_DEV_PORT` | Vite port for `pnpm dev` and `pnpm dev:electron`. When set, Vite fails instead of moving to another port. |
| `DESAFINADO_CDP_PORT` | Chrome DevTools port of the dev window (default 9222). `agent-browser connect <port>` attaches to it. Dev only. |
| `DESAFINADO_USER_DATA_DIR` | Absolute path for Electron's `userData` in `pnpm dev:electron` and `pnpm preview:electron` (not in a packaged app, which takes Chromium's `--user-data-dir=<path>` instead). Always set it for checks, never use the default. |
| `DESAFINADO_DEV_PICK_FILE` | Absolute path of a text file. In `pnpm dev:electron` only (an unpackaged app with the dev server), Open, Save as and the Library's Add skip the native dialog and use the path in that file (a folder, for Add), read at each dialog. For checks, because `agent-browser` cannot drive a GTK dialog; say in the record which checks used it. |

Attach to the window: `DESAFINADO_DEV_PORT=5301 DESAFINADO_CDP_PORT=9301 DESAFINADO_USER_DATA_DIR=$(mktemp -d) pnpm dev:electron`, then `agent-browser connect 9301`.

Off-screen, so a check does not open a window on the maintainer's desktop (needs Xvfb; Electron 43 picks Wayland from `XDG_SESSION_TYPE` and `OZONE_PLATFORM`, so override both):

```bash
env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 OZONE_PLATFORM=x11 xvfb-run -a -s "-screen 0 1440x900x24" env DESAFINADO_DEV_PORT=5301 DESAFINADO_CDP_PORT=9301 DESAFINADO_USER_DATA_DIR=$(mktemp -d) pnpm dev:electron -- --ozone-platform=x11
```

For a Before screenshot, run the parent commit from its own `git worktree`, never by checking out an older commit in a checkout whose dev server someone else is using.

## AI SDK

- Follow [.claude/skills/use-ai-sdk/SKILL.md](.claude/skills/use-ai-sdk/SKILL.md) (copied verbatim from `vercel/ai@c739d37`, `skills/use-ai-sdk/`). **Never write AI SDK code from memory**: read `node_modules/ai/docs/` and the provider's bundled docs first.
- Ignore the skill's AI Gateway section. This project calls OpenRouter through the Vite proxy ([ADR 0005](docs/adr/0005-local-only-vite-proxy.md)).
- Model IDs come from `https://openrouter.ai/api/v1/models`, never from memory.

## Code style

- Functional: pure functions, immutable data, no classes unless a library demands one.
- No comments unless strictly necessary.
- English everywhere: identifiers, files, logs, errors, tests, commits, PRs, issues. UI copy is English too.
- Suggested layout; refine it if the code asks for it, and say so in the PR:

```text
src/
├── main.web.tsx       # Web build entry: builds the Web kit, mounts App
├── main.electron.tsx  # Electron build entry: builds the Electron kit, mounts App
├── platform/      # PlatformKit type and async kit factory, Web kit, Electron kit (files through the preload API, unsaved text per file), start.ts (mount once the factory resolves) (ADR 0016)
├── document/      # Open and Save: file actions, file session, Web DocumentFiles adapter, unsaved text
├── editor/        # CodeMirror setup, decorations, keymaps, motion (moments, AI caret)
├── theme/         # theme roles, book palettes and catalog, contrast, Omarchy theme source, choice and apply (DESIGN.md)
├── suggestions/   # Suggestion state, lifecycle, position mapping (pure)
├── diff/          # adaptive diff (pure)
├── blocks/        # Block extraction from the syntax tree (pure)
├── ai/            # model client, zod schemas, prompt building, AI call records
└── ui/            # React components
electron/
├── api.ts         # the preload API's types and channel names, shared by main and preload
├── main/          # main process: window, IPC handlers, dev switches, trust checks; installed app: app:// handler, OpenRouter forwarder, key store, security headers (installed-app.ts wires them)
│   ├── files/     # Markdown read, atomic save, native dialogs, request validation
│   └── quick-actions/ # quick-actions.json in userData, load and save IPC
└── preload/       # contextBridge API, one function per action
config/            # Vite proxy, shared renderer config, port parsing, Omarchy theme plugin
build/             # packaging resources (icon)
electron-builder.yml  # Linux package, fuses
index.html         # Web build page
electron.html      # Electron build page
electron.vite.config.ts
scripts/
└── bakeoff.ts
```

## Tests

- TDD (red → green → refactor) for pure modules: diff → hunks, Suggestion state and position mapping, Block extraction, prompt building, schema validation, AI call records.
- No E2E suite. UI is verified in a real browser with the `agent-browser` skill; the Electron build is verified in its window over CDP.
- Tests never call the real model.

## Git and PRs

- One branch per issue, from `main`: `feat/ | fix/ | chore/ | refactor/ | docs/ | test/` + short kebab slug, max 40 chars.
- Commit messages: short, imperative, conventional prefix. No `Co-Authored-By` or other authorship trailers.
- PR body: use the `pr` skill, filling [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Start with `Closes #N`.
- Evidence for a visible change is screenshots shown in the PR body, not links to them. Commit them under `docs/screenshots/` and embed each one as `![<issue>-<n>](https://github.com/<owner>/<repo>/raw/<sha>/docs/screenshots/<issue>-<n>.png)`, pinned to a commit SHA so it survives branch deletion; a `[…](…/blob/…)` link does not render. When the change alters something that already shows (a screen, a style, a state, a review fix), add a Before screenshot taken at the parent commit; a new screen has no Before, so say that in one line.
- Squash merge only. A ruleset on `main` requires the `checks` job and allows only squash; its JSON is `.github/ruleset.json`, applied with `.github/apply-ruleset.sh`.

## Definition of done (every slice)

1. `pnpm test` green, with TDD on the pure modules the issue lists.
2. `pnpm biome check` clean and `pnpm build` green. The `checks` job in `.github/workflows/ci.yml` runs both plus `pnpm check:externals` on every PR; the PR body links the run instead of pasting output.
3. The issue's acceptance criteria checked in a real browser with `agent-browser`.
4. Code review done and real findings fixed (roles in [docs/PLAN.md](docs/PLAN.md)).
5. PR opened from the template, then squash-merged.

## AI call records

- In dev mode, the model client appends one record per call to `window.__aiCalls`. It is fed by a custom `registerTelemetry` integration (no OpenTelemetry) and enriched with `GET /api/v1/generation?id=…` through the proxy.
- Read it with `agent-browser` (`eval`) when a check needs cost, latency or the model that served a call.
- Fields: task requested (e.g. "select paragraph 2 → Shorter"), model requested, model and provider that served it, tokens (input / output / reasoning / cached), cost, latency (client total, OpenRouter `latency`, `generation_time`, time to first Suggestion for review passes), `finish_reason`, valid or retried, generation `id`.

## Secrets

- The key lives only in `.env` (`OPENROUTER_API_KEY`). Never commit it, print it, or put it in the bundle.
- The browser sends a placeholder key; the Vite proxy overwrites `Authorization`.
