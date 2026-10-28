# AI costs

Budget: US$5.00, the cap on the OpenRouter key. Every Bake-off run and every verification check that calls a model adds rows here (format in [AGENTS.md](../../AGENTS.md#ai-call-records)). Claude Code usage while building is not billed to this key and is not tracked here.

| Date | Slice / PR | Task | Model → served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Record |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `z-ai/glm-5.3-flash` → Cohere, InferenceNet, DigitalOcean | 2495 / 1002 / 258 / 384 | 0.000770 | 1731 / 3221 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `deepseek/deepseek-v4.1-flash` → AtlasCloud, Fireworks, Relace, PrimeIntellect | 3062 / 1853 / 1107 / 1910 | 0.001853 | 2108 / 5078 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `qwen/qwen3.8-flash` → Alibaba | 1867 / 2806 / 2451 / 1536 | 0.001393 | 13643 / – (median Target / Review) | stop ×4 | 4/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `google/gemini-3.5-flash-lite` → Google | 3201 / 544 / 0 / 0 | 0.002320 | 1813 / 2183 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `google/gemini-3.8-flash` → Google | 3201 / 1204 / 504 / 0 | 0.006916 | 5379 / 6451 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `google/gemini-4-argon` → Google AI Studio, Google | 3894 / 715 / 0 / 0 | 0.014938 | 10305 / 7973 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `anthropic/claude-haiku-5.5` → Azure | 5261 / 983 / 0 / 0 | 0.001018 | 2541 / 3194 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `openai/gpt-6.1-terra` → OpenAI | 2812 / 607 / 0 / 0 | 0.005847 | 2125 / 5549 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off: 4 Quick actions + Review pass | `anthropic/claude-sonnet-5.5` → Azure | 5261 / 1032 / 0 / 0 | 0.020842 | 2145 / 4324 (median Target / Review) | stop ×5 | 5/5, no retries | [bakeoff.md](bakeoff.md) |
| 2026-10-28 | #2 | Bake-off run 1, superseded: 4 Quick actions + Review pass, 9 models (first Rationale wording; 4 models switched language) | all 9 candidates | 31258 / 12029 / 5047 / 1152 | 0.055091 | – | – | 44/45 calls ok, 1 timeout | not kept |
| 2026-10-28 | #2 | Bake-off run 2, superseded: same, after the Rationale fix (the Review prompt made Sonnet and GLM return one junk edit) | all 9 candidates | 31067 / 10332 / 4640 / 2432 | 0.051438 | – | – | 44/45 calls ok, 1 timeout | not kept |
| 2026-10-28 | #2 | Prompt checks: 16 calls on 4 cheap models, then 14 calls on Sonnet, GLM and DeepSeek (Review prompt variants) | `z-ai/glm-5.3-flash`, `deepseek/deepseek-v4.1-flash`, `google/gemini-3.5-flash-lite`, `google/gemini-3.8-flash`, `anthropic/claude-sonnet-5.5` | 28866 / 11008 / 3054 / 3584 | 0.058738 | – | – | – | not kept |
| 2026-10-28 | #2 | Run 4, language-anchor re-check with the ADR 0006 wording: 4 Quick actions + Review pass on 3 models (median Target / Review: DeepSeek 1718 / 5632, GLM 1591 / 4017, Haiku 2308 / 3743 ms) | `deepseek/deepseek-v4.1-flash`, `z-ai/glm-5.3-flash`, `anthropic/claude-haiku-5.5` | 10826 / 4053 / 1457 / 640 | 0.003777 | – | stop ×15 | 15/15, no retries | not kept |
| 2026-10-28 | #2 | Dry runs of `pnpm bakeoff` (4 calls on DeepSeek) and 3 raw probes of the generation endpoint | `deepseek/deepseek-v4.1-flash` | – | ~0.0016 | – | – | – | not kept |
| 2026-10-28 | #2 | Browser check through the Vite proxy: Fix grammar on the `recieve` paragraph (the one recorded call; two earlier calls of the same check left no record) | `deepseek/deepseek-v4.1-flash` → Relace | 372 / 82 / 16 / 256 | 0.000051 | 1293 / 854 / 1030 | stop | 1/1 | [2-model-client.md](verification/2-model-client.md) |
| 2026-10-28 | #2 | Calls without a record: 3 timed-out Qwen requests and 2 browser-check calls (estimated from the key's `usage` counter) | `qwen/qwen3.8-flash`, `deepseek/deepseek-v4.1-flash` | – | ~0.0069 | – | – | – | not kept |
| 2026-10-28 | #3 | select p4 → Clearer | `openai/gpt-6.1-terra` → OpenAI | 513 / 76 / 0 / 0 | 0.000893 | 2386 / 1821 / 2034 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p5 → More formal | `openai/gpt-6.1-terra` → OpenAI | 530 / 69 / 0 / 0 | 0.000875 | 2098 / 1585 / 1757 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p5 → More formal | `openai/gpt-6.1-terra` → OpenAI | 530 / 68 / 0 / 0 | 0.000870 | 1891 / 1411 / 1558 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | select p3 → Shorter | `openai/gpt-6.1-terra` → OpenAI | 516 / 83 / 0 / 0 | 0.000931 | 2809 / 1984 / 2299 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | select p8 → Clearer | `openai/gpt-6.1-terra` → OpenAI | 428 / 68 / 0 / 0 | 0.000768 | 2242 / 1850 / 2004 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p5 → free text: Drop the slang but keep a friendly tone | `openai/gpt-6.1-terra` → OpenAI | 522 / 54 / 0 / 0 | 0.000792 | 1831 / 1538 / 1556 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p9 → Shorter | `openai/gpt-6.1-terra` → OpenAI | 437 / 32 / 0 / 0 | 0.000597 | 1537 / 1278 / 1278 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p4 → Fix grammar | `openai/gpt-6.1-terra` → OpenAI | 500 / 71 / 0 / 0 | 0.000855 | 1935 / 1482 / 1674 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | select p9 → Clearer | `openai/gpt-6.1-terra` → OpenAI | 458 / 31 / 0 / 0 | 0.000613 | 1814 / 1548 / 1548 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | cursor in p12 → Fix grammar | `openai/gpt-6.1-terra` → OpenAI | 413 / 58 / 0 / 0 | 0.000703 | 2340 / 1602 / 1605 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | select p12 → free text: Correct the spelling mistake only | `openai/gpt-6.1-terra` → OpenAI | 432 / 41 / 0 / 0 | 0.000637 | 1815 / 1436 / 1436 | stop | 1/1 | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | Forced failures (2 network aborts, 3 out-of-credit stubs) and 1 request aborted by typing inside its Target | `openai/gpt-6.1-terra` | – | 0 for the stubs, not reported for the aborted request | 2 to 178 (client) | – | 5 stubs, 1 aborted | [3-selection-suggestions.md](verification/3-selection-suggestions.md) |
| 2026-10-28 | #3 | Calls without a record: Shorter on p3 and Fix grammar on p12 before the first reload, free text on p12 lost on a reload (estimated from the key's usage counter) | `openai/gpt-6.1-terra` | – | ~0.0022 | – | – | – | not kept |
| 2026-10-28 | #4 | cursor in p3 → Shorter | `openai/gpt-6.1-terra` → OpenAI | 516 / 86 / 0 / 0 | 0.000946 | 2640 / 1667 / 2022 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | refine p3 → make it shorter | `openai/gpt-6.1-terra` → OpenAI | 616 / 70 / 0 / 0 | 0.000966 | 2487 / 1763 / 1973 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | refine p3 → now more formal | `openai/gpt-6.1-terra` → OpenAI | 606 / 79 / 0 / 0 | 0.001001 | 1994 / 1483 / 1738 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | refine p3 → drop the adjectives (after a forced network failure and a forced 402, then Retry) | `openai/gpt-6.1-terra` → OpenAI | 616 / 78 / 0 / 0 | 0.001006 | 2035 / 1526 / 1791 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | cursor in p4 → Clearer | `openai/gpt-6.1-terra` → OpenAI | 513 / 74 / 0 / 0 | 0.000883 | 2036 / 1591 / 1795 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | cursor in p5 → More formal | `openai/gpt-6.1-terra` → OpenAI | 533 / 67 / 0 / 0 | 0.000868 | 1954 / 1634 / 1728 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | cursor in p5 → More formal | `openai/gpt-6.1-terra` → OpenAI | 533 / 69 / 0 / 0 | 0.000878 | 2380 / 1923 / 2089 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | cursor in p1 → Shorter | `openai/gpt-6.1-terra` → OpenAI | 404 / 30 / 0 / 0 | 0.000554 | 1566 / 1327 / 1327 | stop | 1/1 | [4-refine.md](verification/4-refine.md) |
| 2026-10-28 | #4 | Forced failures (1 network, 1 out-of-credit), 3 Refines held in flight and aborted by Reject, Accept and typing, 1 stubbed answer for the "no change" check | `openai/gpt-6.1-terra` | – | 0 for the failures and the stub, not reported for the aborted requests (they never reached OpenRouter) | 3 to 1454 (client) | – | 2 failures, 3 aborted, 1 stub | [4-refine.md](verification/4-refine.md) |

**Running total:** US$0.252 of 5.00

Notes on slice 2:
- The first nine rows are the final Bake-off run, the one in [bakeoff.md](bakeoff.md): US$0.0559, well under the US$0.50 budget. The other rows are what it took to get the prompts right (two full runs, prompt checks, dry runs), so the slice total is about US$0.23.
- Latency for the Bake-off rows is the median Target request / the Review pass, client wall time. A dash means the request failed (Qwen's Review pass timed out at 60 s).
- Cost per call is the `usage.cost` OpenRouter returns. Calls that time out return no usage, so their cost is estimated from the rise of the key's `usage` counter (US$8.743 to US$8.973 across the slice, minus the recorded rows). That counter is the lifetime usage of the key, not this project's.
- OpenRouter publishes `/generation` data (provider, `latency`, `generation_time`) about a minute after the call, so the client records a call right away and enriches it later.

Notes on slice 3:
- Slice cost is about US$0.011: 11 recorded calls US$0.0085, three calls without a record about US$0.0022, and the aborted request, whose usage OpenRouter did not report. The key's usage counter rose by about US$0.0104 over the slice, which agrees with the sum within the error of its starting point. The slice budget was US$0.10.
- The forced-failure checks never reached OpenRouter, so they cost nothing.

Notes on slice 4:
- Slice cost is about US$0.0071: 8 real calls, all recorded (5 Quick actions to open Suggestions, 3 Refines). The failures, the aborted requests and the stub never reached OpenRouter. The slice budget was US$0.05.
- A Refine request carries about 100 input tokens more than a Quick action (history and latest Replacement), so it costs about US$0.001 against US$0.0009.
