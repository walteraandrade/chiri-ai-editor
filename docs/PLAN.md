# Implementation plan

Runbook for the implementation orchestrator. The planning session produced this plan, the [ADRs](chiri/adr/) and the issues below. Read [AGENTS.md](../AGENTS.md) and [GLOSSARY.md](../GLOSSARY.md) first.

## Roles

| Role | Model | Notes |
|---|---|---|
| Orchestrator | `opus` | Runs the loop below, owns gates, merges PRs. Claude Code only, so every session log lands in `~/.claude/projects/`. |
| Implementer | `sonnet` subagent | One at a time, in the orchestrator's checkout, on the slice branch. |
| Reviewer, first pass | `opus` subagent, effort `medium` | Two axes, as in the `code-review` skill: **Standards** (against [AGENTS.md](../AGENTS.md)) and **Spec** (against the issue and its ADRs). |
| Reviewer, later passes | `sonnet` subagent | Re-checks the fixes until no real findings remain. |

Slices run **sequentially**. Each builds on the previous one, and running them in parallel would collide on `package.json` and shared modules.

## Loop per slice

1. Branch from up-to-date `main`, using the name in the table below.
2. Implementer: TDD the pure modules the issue lists, then the UI.
3. Run the definition of done ([AGENTS.md](../AGENTS.md#definition-of-done-every-slice)): tests, Biome, build.
4. Verify the acceptance criteria in a real browser with `agent-browser`. Record the AI calls and screenshots ([AGENTS.md](../AGENTS.md#ai-call-records)) and update [chiri/ai-costs.md](chiri/ai-costs.md).
5. Open the PR with the `pr` skill and the [template](../.github/PULL_REQUEST_TEMPLATE.md).
6. First review (`opus`, medium), fix, then re-review (`sonnet`) until clean. Note the review outcome in the PR.
7. Squash merge.
8. If the slice ends at a gate, stop and wait.

## Slices

| # | Issue | Branch | Scope | Depends on | Gate after | Est. |
|---|---|---|---|---|---|---|
| 1 | [#1](https://github.com/walteraandrade/chiri-ai-editor/issues/1) | `feat/editor-shell` | Vite + React + TS + Tailwind, CodeMirror with styled Markdown, sample Document, `localStorage`, proxy, missing-key banner, Biome, Vitest | — | — | 45 min |
| 2 | [#2](https://github.com/walteraandrade/chiri-ai-editor/issues/2) | `feat/model-client-bakeoff` | AI SDK client, zod schemas, prompt building, Block extraction, AI call records, `scripts/bakeoff.ts`, `docs/chiri/bakeoff.md` | 1 | **A** | 60 min |
| 3 | [#3](https://github.com/walteraandrade/chiri-ai-editor/issues/3) | `feat/selection-suggestions` | Selection bubble, `Cmd+K`, Quick actions, Suggestion state and mapping, adaptive diff, overlay decorations, Accept / Reject, Rationale, errors | 2, Gate A | **B** | 90 min |
| 4 | [#4](https://github.com/walteraandrade/chiri-ai-editor/issues/4) | `feat/refine` | Refine on the Active Suggestion, history, diff against original | 3, Gate B | — | 30 min |
| 5 | [#5](https://github.com/walteraandrade/chiri-ai-editor/issues/5) | `feat/review-pass` | Review pass with Focus, numbered Blocks, streamed validated Suggestions (max 6), skip occupied Blocks, Accept all / Reject all | 4 | — | 45 min |
| 6 | [#6](https://github.com/walteraandrade/chiri-ai-editor/issues/6) | `docs/readme-and-sessions` | Final README, backlog review, session export script, `ai-sessions/` | 5 | **C** | 30 min |

That is about 5 h 15 of work, plus 30–40 min of reviews. If time runs short, shrink slice 5 first.

## Gates

- **A, after slice 2 (model):** present `docs/chiri/bakeoff.md`, with outputs side by side, latency, cost and validity. The maintainer picks the model or models. Update [ADR 0010](chiri/adr/0010-model-bakeoff.md) to Accepted and set the default in `.env.example`. If any Target-request latency is above ~3 s, flag the Draft reopen rule ([ADR 0008](chiri/adr/0008-validated-streaming-only.md)).
- **B, after slice 3 (core flow):** the maintainer tries select → Suggestion → Accept / Reject in the browser. Fix taste issues before Refine and the Review pass build on top.
- **C, before merging slice 6 (submission):** final look at the README, cost log, sessions and repo.

## Budget

US$5 OpenRouter cap. The Bake-off should stay under US$0.50. Every model call made during verification goes into [chiri/ai-costs.md](chiri/ai-costs.md). If the running total passes US$2, stop and tell the maintainer.

## Session logs (slice 6)

The challenge requires raw, unedited session files committed to the repo. Only secrets may be masked.

- Source: every folder in `~/.claude/projects/` whose name starts with `-home-walter-Github-chiri-ai-editor` (this covers every worktree). Copy each session's `<id>.jsonl` and its sibling `<id>/` folder (subagents, tool results) as they are. Skip non-session files such as `memory/`.
- Destination: `ai-sessions/<project-folder>/…`.
- Masking: replace OpenRouter keys (`sk-or-…`) with `sk-or-***MASKED***`, and nothing else.
- The script lives in `scripts/` and runs last, after the final PR text is written, so it captures as much as possible. Note in the README that the orchestrator session continues after the export.
- Claude Code deletes transcripts older than `cleanupPeriodDays`, 30 days by default. Export before then.
