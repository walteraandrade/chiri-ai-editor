# AGENTS.md

Browser Markdown editor with an AI co-author. The AI proposes inline, reviewable suggestions; the user accepts, rejects, or refines them. Built for the [Chiri assessment](docs/chiri/CHALLENGE.md).

## Read first

1. [GLOSSARY.md](GLOSSARY.md) — use these names in code, UI, PRs and issues.
2. [docs/PLAN.md](docs/PLAN.md) — slices, roles, gates, the per-slice loop.
3. The GitHub issue you are working on, and every ADR it links in [docs/chiri/adr/](docs/chiri/adr/).

ADRs are decisions, not suggestions. If an ADR blocks you, stop and report it; do not work around it.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node 22+ (required by `ai@7`) |
| Package manager | pnpm (pin with `packageManager` in `package.json`) |
| App | Vite + React + TypeScript (strict) |
| Editor | CodeMirror 6, `@codemirror/lang-markdown` |
| Styling | Tailwind v4, theme tokens in CSS via `@theme`; dark theme only; sans-serif; League Spartan for the app title |
| AI | `ai@^7` + `@openrouter/ai-sdk-provider@^3` + `zod` |
| Diff | `diff` (jsdiff) |
| Tests | Vitest |
| Lint/format | Biome |

Commands (once slice 1 lands): `pnpm dev`, `pnpm test`, `pnpm biome check`, `pnpm build`. Slice 2 adds `pnpm bakeoff`.

## AI SDK

- Follow [.claude/skills/use-ai-sdk/SKILL.md](.claude/skills/use-ai-sdk/SKILL.md) (copied verbatim from `vercel/ai@c739d37`, `skills/use-ai-sdk/`). **Never write AI SDK code from memory**: read `node_modules/ai/docs/` and the provider's bundled docs first.
- Ignore the skill's AI Gateway section. This project calls OpenRouter through the Vite proxy ([ADR 0005](docs/chiri/adr/0005-local-only-vite-proxy.md)).
- Model IDs come from `https://openrouter.ai/api/v1/models`, never from memory.

## Code style

- Functional: pure functions, immutable data, no classes unless a library demands one.
- No comments unless strictly necessary.
- English everywhere: identifiers, files, logs, errors, tests, commits, PRs, issues. UI copy is English too.
- Suggested layout; refine it if the code asks for it, and say so in the PR:

```text
src/
├── editor/        # CodeMirror setup, decorations, keymaps
├── suggestions/   # Suggestion state, lifecycle, position mapping (pure)
├── diff/          # adaptive diff (pure)
├── blocks/        # Block extraction from the syntax tree (pure)
├── ai/            # model client, zod schemas, prompt building, AI call records
└── ui/            # React components
scripts/
└── bakeoff.ts
```

## Tests

- TDD (red → green → refactor) for pure modules: diff → hunks, Suggestion state and position mapping, Block extraction, prompt building, schema validation, AI call records.
- No E2E suite. UI is verified in a real browser with the `agent-browser` skill.
- Tests never call the real model.

## Git and PRs

- One branch per issue, from `main`: `feat/ | fix/ | chore/ | refactor/ | docs/ | test/` + short kebab slug, max 40 chars.
- Commit messages: short, imperative, conventional prefix. No `Co-Authored-By` or other authorship trailers.
- PR body: use the `pr` skill, filling [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Start with `Closes #N`.
- Squash merge only.

## Definition of done (every slice)

1. `pnpm test` green, with TDD on the pure modules the issue lists.
2. `pnpm biome check` clean and `pnpm build` green.
3. The issue's acceptance criteria checked in a real browser with `agent-browser`.
4. AI calls made during that check recorded (next section), with screenshots.
5. Code review done and real findings fixed (roles in [docs/PLAN.md](docs/PLAN.md)).
6. PR opened from the template, then squash-merged.

## AI call records

Every check that calls the model is recorded. This is how the US$5 budget is accounted for.

- In dev mode, the model client appends one record per call to `window.__aiCalls`. It is fed by a custom `registerTelemetry` integration (no OpenTelemetry) and enriched with `GET /api/v1/generation?id=…` through the proxy.
- After a check, read the log with `agent-browser` (`eval`).
- Fields: task requested (e.g. "select paragraph 2 → Shorter"), model requested, model and provider that served it, tokens (input / output / reasoning / cached), cost, latency (client total, OpenRouter `latency`, `generation_time`, time to first Suggestion for review passes), `finish_reason`, valid or retried, generation `id`.
- Where:
  - `docs/chiri/verification/<issue>-<slug>.md`: the full table plus screenshots for that slice.
  - `docs/chiri/verification/img/<issue>-<n>.png`: screenshots, committed. Link them in the PR by commit SHA so links survive branch deletion.
  - [docs/chiri/ai-costs.md](docs/chiri/ai-costs.md): one row per check, plus the running total against the US$5 cap.
  - PR: a summary table under Evidence.

## Secrets

- The key lives only in `.env` (`OPENROUTER_API_KEY`). Never commit it, print it, or put it in the bundle.
- The browser sends a placeholder key; the Vite proxy overwrites `Authorization`.

## Gates

The orchestrator stops and waits for the maintainer at the gates in [docs/PLAN.md](docs/PLAN.md). Never skip a gate.
