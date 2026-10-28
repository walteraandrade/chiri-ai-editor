# 0009. AI SDK v7 instead of plain fetch

- Status: Accepted (2026-10-28)
- Source: planning session, Q31 (web-verified on 2026-10-28)

## Context

Without streaming, plain `fetch` + zod was ~60–80 lines and fully transparent. With validated element streaming ([0008](0008-validated-streaming-only.md)) and per-call records ([AGENTS.md](../../../AGENTS.md#ai-call-records)), the SDK pays for itself.

Facts at decision time:
- `ai@7.0.155` (7.0.0 released 2026-06-25) and `@openrouter/ai-sdk-provider@3.1.0`, which targets `ai@^7`. Both are ESM-only and require Node 22+.
- Telemetry in v7 is a pluggable integration (`registerTelemetry`). A custom integration receives lifecycle events (`onStart`, `onStepEnd` with `usage`, `onEnd`, …) without OpenTelemetry.
- Every OpenRouter response includes `usage` with `cost`, reasoning tokens and cached tokens. `GET /api/v1/generation?id=…` adds `latency`, `generation_time`, `provider_name`, native token counts and more.

## Decision

- Use `ai@^7` + `@openrouter/ai-sdk-provider@^3` + `zod`.
- The provider uses `baseURL` = `${location.origin}/api/openrouter` and a placeholder key. The proxy injects the real key.
- AI call records come from a custom `registerTelemetry` integration plus the generation endpoint.
- `scripts/bakeoff.ts` uses the same client in Node with the real key, so the Bake-off tests the code the app runs.
- Agents follow `.claude/skills/use-ai-sdk` and never write SDK code from memory.

## Consequences

- Element streaming with validation, lifecycle hooks for records, and a cheap path to Draft streaming later.
- Two more dependencies. Node 22+ goes in the README.
- Official recipes run the SDK on a server. We run it in the browser. The core uses `fetch`, and a Chrome article shows `streamText()` working in the browser.
- **Risk:** the provider README does not document `Output.object` or `json_schema`. Slice 2 must verify this. The fallback is `@ai-sdk/openai-compatible` (not yet verified).

## Alternatives considered

- **Plain `fetch` + zod:** smallest and transparent, but no validated element streaming.
- **OpenTelemetry export:** from the browser it needs a vendor key in the bundle, or a server.
- **AI SDK DevTools:** stores data in a local JSON file, so it only works in Node. Usable for the Bake-off only.
