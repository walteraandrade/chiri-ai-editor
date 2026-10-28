# Slice 2 verification: model client and Bake-off

Issue [#2](https://github.com/walteraandrade/chiri-ai-editor/issues/2). This slice has no UI, so the checks are a captured request body, one call through the Vite proxy from a real browser, and the Bake-off.

## Strict structured output: confirmed

`@openrouter/ai-sdk-provider@3.1.0` sends a strict JSON schema for both `Output.object` and `Output.array`, so the fallback `@ai-sdk/openai-compatible` is not needed and [ADR 0009](../adr/0009-ai-sdk-v7.md) stands.

The tests in `src/ai/client.test.ts` inject a `fetch` that captures the request body (no network). A Target request (`Output.object` with `suggestionSchema`) sends:

```json
{
  "model": "vendor/model-a",
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "schema": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "replacement": { "type": "string", "description": "The new text that replaces the Target, in Markdown, in the language of the Target." },
          "rationale": { "type": "string", "description": "One short sentence explaining the change, in the language of the Document." }
        },
        "required": ["replacement", "rationale"],
        "additionalProperties": false
      },
      "strict": true,
      "name": "response"
    }
  },
  "messages": [{ "role": "system", "content": [{ "type": "text", "text": "…" }] }, { "role": "user", "content": "…" }],
  "reasoning": { "effort": "low" },
  "provider": { "require_parameters": true }
}
```

The Review pass (`Output.array` + `streamText`) sends the same envelope with `"stream": true` and this schema. The SDK owns the array wrapper, so the wire shape is `{ "elements": [...] }`, not the `{ "edits": [...] }` of [ADR 0002](../adr/0002-structured-output-app-owned-anchors.md):

```json
{
  "type": "object",
  "properties": {
    "elements": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "blockId": { "type": "string" }, "replacement": { "type": "string" }, "rationale": { "type": "string" } },
        "required": ["blockId", "replacement", "rationale"],
        "additionalProperties": false
      }
    }
  },
  "required": ["elements"],
  "additionalProperties": false
}
```

Where the settings come from, read in the provider source (`dist/index.js`, `getArgs`): `provider` and `reasoning` are model settings (`provider.chat(model, { provider: { require_parameters: true }, structuredOutputs: { strict: true }, reasoning: { effort: 'low' } })`). `strict` already defaults to `true`; the client sets it anyway. The same keys also work through `providerOptions.openrouter`, which the provider spreads into the body.

## Other findings from the SDK and the API

- With `streamText`, a provider error (HTTP 402, 429, ...) does not throw from `elementStream`. The stream just ends and `output` rejects with `NoOutputGeneratedError`. The real error only arrives through the `onError` callback, so the client captures it there.
- `elementStream` emits an element when the next one starts or the output is complete, so the first Suggestion is delayed by roughly one element.
- A timeout raises a `TimeoutError` `DOMException`; the SDK does not retry it.
- `GET /generation?id=…` answers 404 for about a minute after the call (measured at 64 s). The client records the call right away from telemetry and enriches the record later, polling every 10 s after a 30 s wait.
- The top-level `reasoning` option of the AI SDK is not read by `getArgs` in this provider version (read from source, not tested); reasoning goes through the provider setting.
- All 9 Bake-off candidates accept `reasoning.effort: "low"` together with `require_parameters: true` (checked against `GET /api/v1/models`: some cannot turn reasoning off, all accept `low`).

## Browser check through the proxy

`pnpm dev` with a temporary DEV-only hook in `src/main.tsx` (not committed) that built the client with `createBrowserModelClient()`. In the page, `fetch` was wrapped to record outgoing headers, then a "Fix grammar" Target request was made on the `recieve` paragraph of the sample Document, with `agent-browser`.

- The request went to `http://localhost:5199/api/openrouter/chat/completions` with `Authorization: Bearer browser-placeholder-key`. The real key never reached the page; the proxy added it.
- The Suggestion came back valid: `replacement` "Once the canary looks healthy, you will receive a prompt…", `rationale` "Corrected the spelling of "recieve" to "receive".".
- `window.__aiCalls` got the record immediately, and about a minute later the same entry was replaced by the enriched one (`openRouter` and `generation` latencies, served model with its date suffix).
- After `pnpm build`: `grep -r "sk-or-" dist/` returns nothing, and neither does a search for the key's value.

![App with the client wired in, key present, no banner](img/2-1.png)

AI call record of that check:

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browser check: Fix grammar on the recieve paragraph | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · Relace | 372 / 82 / 16 / 256 | 0.000051 | 1293 / 854 / 1030 | stop | valid | gen-1793193867-o7T3O9Bwhr9dn23uy3jC |

Two earlier calls of the same check targeted the wrong text (the editor only renders the visible lines) and were not recorded; they are counted in [ai-costs.md](../ai-costs.md).

## Bake-off

Final run: [bakeoff.md](../bakeoff.md), US$0.0559. It took three full runs because the Rationale wording and the Review prompt needed two fixes; the story is in the "Why three runs" section there. The whole slice cost US$0.23, see [ai-costs.md](../ai-costs.md).
