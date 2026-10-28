# 0010. Choose the model by Bake-off

- Status: **Proposed**. Decided at Gate A ([docs/PLAN.md](../../PLAN.md#gates)).
- Source: planning session, Q23, Q33

## Context

On 2026-10-28, from OpenRouter's public API. Prices are US$ per million tokens. Cost per call assumes ~3k input and ~500 output tokens (a Review pass).

| Tier | Model | Origin | Input | Output | ~Cost/call | Providers |
|---|---|---|---|---|---|---|
| Cheap | `anthropic/claude-haiku-5.5` | US | 0.10 | 0.50 | 0.0006 | 10 |
| Cheap | `openai/gpt-6-luna` | US | 0.10 | 0.50 | 0.0006 | 7 |
| Cheap | `deepseek/deepseek-v4.1-flash` | CN | 0.14 | 0.42 | 0.0006 | 41 |
| Cheap | `z-ai/glm-5.3-flash` | CN | 0.15 | 0.50 | 0.0007 | 38 |
| Cheap | `qwen/qwen3.8-flash` | CN | 0.15 | 0.47 | 0.0007 | 2 |
| Cheap | `minimax/minimax-m3.1-flash` | CN | 0.15 | 0.60 | 0.0008 | 13 |
| Cheap | `z-ai/glm-5.3` | CN | 0.07 | 1.40 | 0.0009 | 49 |
| Mid | `google/gemini-3.5-flash-lite` | US | 0.30 | 2.50 | 0.002 | 8 |
| Mid | `deepseek/deepseek-v4-pro-0813` | CN | 0.66 | 1.98 | 0.003 | 25 |
| Mid | `google/gemini-3.8-flash` | US | 0.83 | 4.13 | 0.005 | 7 |
| Mid | `openai/gpt-6.1-terra` | US | 1 | 5 | 0.006 | 4 |
| Top | `qwen/qwen3.8-max-0902` | CN | 2 | 6 | 0.009 | 2 |
| Top | `google/gemini-4-argon` | US | 2 | 10 | 0.011 | 6 |
| Top | `anthropic/claude-sonnet-5.5` | US | 2 | 10 | 0.011 | 8 |
| Top | `moonshotai/kimi-k3.1-pro` | CN | 2 | 10 | 0.011 | 2 |

Notes:
- Every model listed supports `structured_outputs` on at least some providers (`z-ai/glm-5.3-flash`: 32 of 38). `z-ai/glm-5.3-flashx` and `z-ai/glm-5.3-prime` were excluded because they don't support it.
- Open-weight models are served by many providers with different quantization, so quality and latency depend on who serves the call. Pinning a provider trades away automatic fallback.
- OpenRouter's API returns `latency_last_30m: null`, so there is no speed data up front.
- Most of these models were released after the planning model's training data. Choosing from this table alone would be choosing by brand and price.

## Decision

`scripts/bakeoff.ts` runs the same requests against 9 models:

`z-ai/glm-5.3-flash`, `deepseek/deepseek-v4.1-flash`, `qwen/qwen3.8-flash`, `google/gemini-3.5-flash-lite`, `google/gemini-3.8-flash`, `google/gemini-4-argon`, `anthropic/claude-haiku-5.5`, `openai/gpt-6.1-terra`, `anthropic/claude-sonnet-5.5`.

- **Requests:** the 4 Quick actions on fixed Targets of the sample Document, plus 1 Review pass.
- **Measured:** latency, cost, schema validity and retries, plus the outputs side by side. Written to `docs/chiri/bakeoff.md`.
- **Choice:** the maintainer picks by reading the outputs. Tie-breakers, in order: Target-request latency under ~3 s, then cost. The result may be two models: a fast one for Target requests and a strong one for the Review pass.
- **Default:** configurable via `OPENROUTER_MODEL`.
- **Budget:** under US$0.50.

## Consequences

- The choice rests on evidence, not on a guess.
- About 30–40 minutes of work, plus a Gate.
- The Bake-off also verifies the `Output.object` risk from [0009](0009-ai-sdk-v7.md).
