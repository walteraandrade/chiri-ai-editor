# Bake-off

Run on 2026-10-28 by `pnpm bakeoff`, which uses the same client and prompts as the app ([ADR 0010](adr/0010-model-bakeoff.md)).

- Input: the sample Document; 4 Quick actions on fixed Targets plus 1 Review pass without Focus.
- Settings for every model: strict JSON schema, `provider.require_parameters: true`, reasoning effort `low`, 30 s timeout for Target requests and 60 s for the Review pass, one silent retry on invalid output, models called one after another.
- The sample Document is English, so a Rationale in another language is a slip of the model (rule 5 of [ADR 0006](adr/0006-context-and-prompt-rules.md)). "Rationale not in English" is a heuristic count, read the outputs to confirm.
- Latencies are client wall time per request, including the silent retry when there was one. Cost comes from the OpenRouter `usage.cost` of each call.
- **Total cost: US$0.0559** of the US$0.50 Bake-off budget.

## Summary

| Model | Served by | Target median (ms) | Shorter (ms) | Clearer (ms) | More formal (ms) | Fix grammar (ms) | Review total (ms) | Review first Suggestion (ms) | Review edits | Cost (US$) | OK | Valid first try | Retries | Failures | Rationale not in English |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `z-ai/glm-5.3-flash` | Cohere, InferenceNet, DigitalOcean | 1731 | 1662 | 1799 | 1838 | 1063 | 3221 | 2280 | 5 | 0.0008 | 5/5 | 5/5 | 0 | 0 | 2/9 |
| `deepseek/deepseek-v4.1-flash` | AtlasCloud, Fireworks, Relace, PrimeIntellect | 2108 | 3334 | 1426 | 2480 | 1736 | 5078 | 4204 | 5 | 0.0019 | 5/5 | 5/5 | 0 | 0 | 7/9 |
| `qwen/qwen3.8-flash` | Alibaba | **13643** (above ~3 s) | 13239 | 18550 | 14047 | 7918 | – | – | 0 | 0.0014 | 4/5 | 4/5 | 0 | 1 | 0/4 |
| `google/gemini-3.5-flash-lite` | Google | 1813 | 1824 | 2101 | 1802 | 1518 | 2183 | 1544 | 4 | 0.0023 | 5/5 | 5/5 | 0 | 0 | 0/8 |
| `google/gemini-3.8-flash` | Google | **5379** (above ~3 s) | 3369 | 6501 | 4256 | 6960 | 6451 | 4439 | 5 | 0.0069 | 5/5 | 5/5 | 0 | 0 | 0/9 |
| `google/gemini-4-argon` | Google AI Studio, Google | **10305** (above ~3 s) | 15279 | 5628 | 5167 | 14982 | 7973 | 4991 | 5 | 0.0149 | 5/5 | 5/5 | 0 | 0 | 0/9 |
| `anthropic/claude-haiku-5.5` | Azure | 2541 | 2671 | 2410 | 5076 | 1729 | 3194 | 2067 | 4 | 0.0010 | 5/5 | 5/5 | 0 | 0 | 0/8 |
| `openai/gpt-6.1-terra` | OpenAI | 2125 | 2407 | 1843 | 4368 | 1837 | 5549 | 1627 | 5 | 0.0058 | 5/5 | 5/5 | 0 | 0 | 0/9 |
| `anthropic/claude-sonnet-5.5` | Azure | 2145 | 2524 | 2100 | 2145 | 2144 | 4324 | 2266 | 5 | 0.0208 | 5/5 | 5/5 | 0 | 0 | 0/9 |

## Draft reopen rule

[ADR 0008](adr/0008-validated-streaming-only.md): if the chosen model's median Target-request latency is above ~3 s, the Draft preview is reopened. Median of the 4 Quick actions, client wall time including a silent retry when there was one.

- `qwen/qwen3.8-flash`: median 13643 ms, above ~3 s
- `google/gemini-3.8-flash`: median 5379 ms, above ~3 s
- `google/gemini-4-argon`: median 10305 ms, above ~3 s

## Notes for the choice

Written by hand after the run. The tables above and below are generated.

- **Timeout.** The runs used 60 s for the Review pass. After the run it was set back to 30 s, as [ADR 0007](adr/0007-suggestion-lifecycle.md) says; every model except `qwen/qwen3.8-flash` finished its Review pass in under 8 s.
- **Validity.** All 9 models returned schema-valid output on the first try in every request: 0 retries and 0 edits dropped by the app checks, in all three runs. The strict JSON schema with `require_parameters: true` held for every candidate.
- **Latency.** Six models have a median Target request under ~3 s in all three runs (see the table below). `google/gemini-3.8-flash` (3.8 to 5.4 s), `google/gemini-4-argon` (5.0 to 10.3 s) and `qwen/qwen3.8-flash` (11 to 15 s) are over the ADR 0008 line, so picking one of them reopens the Draft preview.
- **Review pass.** The first Suggestion arrives after 30 to 85 % of the total time in this run: `openai/gpt-6.1-terra` is the earliest (1.6 s of 5.5 s), `deepseek/deepseek-v4.1-flash` the latest (4.2 s of 5.1 s). `qwen/qwen3.8-flash` finished the Review pass once in three runs (26.9 s) and timed out at 60 s the other two times.
- **Rationale language.** The Document is English. `deepseek/deepseek-v4.1-flash` and `z-ai/glm-5.3-flash` write the Rationale in German, French, Dutch, Italian, Portuguese and others, in 7 of 9 and 2 of 9 Rationales in this run. They did it in the earlier runs too, with different wording of rule 5. With the final wording the other seven models never did; the two small Gemini models slipped only in run 1. This is a rule 5 failure, and it is the main quality difference between the cheap models.
- **What the models edit.** Most Review passes pick the same Blocks: p3 (the overlong paragraph), p5 (the slang), p8 (the list), p9 (the repeated review rule) and p12 (the typo). `anthropic/claude-haiku-5.5` skips p9 and `google/gemini-3.5-flash-lite` skips p3.
- **Cost.** US$0.0559 for this run. For the same 5 requests `anthropic/claude-sonnet-5.5` costs roughly 20 to 27 times what `anthropic/claude-haiku-5.5` and `z-ai/glm-5.3-flash` cost, and `google/gemini-4-argon` roughly 15 to 19 times.

### Run-to-run spread

The Bake-off ran three times because the prompts changed in between (see below), so each model has three samples. The columns are run 1 / run 2 / run 3. The numbers in this document are run 3.

| Model | Target median (ms) | Review total (ms) |
| --- | --- | --- |
| `z-ai/glm-5.3-flash` | 1330 / 1930 / 1731 | 3162 / 1383 / 3221 |
| `deepseek/deepseek-v4.1-flash` | 1529 / 1330 / 2108 | 3097 / 4017 / 5078 |
| `qwen/qwen3.8-flash` | 14710 / 11440 / 13643 | 26862 / timeout / timeout |
| `google/gemini-3.5-flash-lite` | 1926 / 2033 / 1813 | 2519 / 2853 / 2183 |
| `google/gemini-3.8-flash` | 3837 / 4004 / 5379 | 4705 / 5930 / 6451 |
| `google/gemini-4-argon` | 4958 / 5802 / 10305 | 7762 / 6626 / 7973 |
| `anthropic/claude-haiku-5.5` | 1994 / 2106 / 2541 | 4397 / 3146 / 3194 |
| `openai/gpt-6.1-terra` | 1973 / 1924 / 2125 | 4859 / 4695 / 5549 |
| `anthropic/claude-sonnet-5.5` | 2374 / 2253 / 2145 | 5170 / 1959 / 4324 |

Run 2 is not a clean sample for the Review pass: its prompt made `anthropic/claude-sonnet-5.5` and `z-ai/glm-5.3-flash` return one junk edit, which is why their run 2 totals are short.

### Why three runs

1. **Run 1.** The Rationale rule said "the language of the text you receive, not the language of these rules". Four models (GLM, DeepSeek, both small Gemini) answered in French, German or Spanish on an English Document, probably because the negative wording pushes a model away from English.
2. **Run 2.** The rule was reworded as a positive anchor ("the same language as the Document text") and the Rationale schema field says "in the same language as the replacement". The anchor sentence was added at the end of the Review instructions, and `anthropic/claude-sonnet-5.5` and `z-ai/glm-5.3-flash` started returning a single junk edit (`replacement: "x"`, or the last paragraph replaced by "Thank you!"). Removing the sentence restored Sonnet in 2 of 2 checks.
3. **Run 3.** The sentence now sits after the Blocks, at the very end of the Review prompt. Sonnet, GLM and the rest behave. This is the prompt the app ships.

The junk edit passed every app check (known Block, changed, not empty). A guard against a Replacement that is a tiny fraction of the original is worth considering in slice 5.

## Quick actions

### Shorter (p3)

**Original**

```
For the past two years our team has frozen all production deployments on Fridays, a rule introduced after a painful weekend incident in 2022 that was entirely reasonable at the time but has since hardened into a habit nobody questions, even though it slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are actually waiting for.
```

#### `z-ai/glm-5.3-flash` (1662 ms)

```
For the past two years, we have frozen all production deployments on Fridays. The rule came after a painful weekend incident in 2022 and was reasonable at the time, but it has since hardened into a habit nobody questions. It slows every sprint, pushes risky changes into the early week when the team is stretched thin by planning and support, and makes it harder to ship the small fixes customers are waiting for.
```

Rationale: Divide the overloaded sentence into shorter ones while keeping every key point, eliminating the unnecessary filler like "entirely" and "actually".

#### `deepseek/deepseek-v4.1-flash` (3334 ms)

```
For two years we froze all Friday production deployments, a rule born from a painful weekend incident in 2022. It was reasonable then, but it has hardened into an unquestioned habit: it slows every sprint, pushes risky changes into a week already stretched by planning and support, and delays the small fixes customers are waiting for.
```

Rationale: Trims filler and repetition while keeping the origin, the shift from reasonable rule to habit, and all three drawbacks.

#### `qwen/qwen3.8-flash` (13239 ms)

```
For two years we have frozen production deployments on Fridays after a painful 2022 weekend incident. Once reasonable, the rule has hardened into an unquestioned habit that slows sprints, pushes risky changes into stretched early-week periods, and delays small fixes customers are waiting for.
```

Rationale: Shortened the sentence while keeping all key points: the incident-based rule, its outdated habit, and its effects on sprints, risky early-week changes, and small customer fixes.

#### `google/gemini-3.5-flash-lite` (1824 ms)

```
For two years, we have frozen Friday deployments due to a 2022 incident. This rule now slows sprints, concentrates risky changes early in the week, and delays small fixes.
```

Rationale: Condensed the long sentence to remove filler while retaining all key points.

#### `google/gemini-3.8-flash` (3369 ms)

```
For two years, we have frozen Friday production deployments following a painful 2022 weekend incident. While reasonable then, this rule now needlessly slows sprints, pushes risky changes into already busy early-week planning and support windows, and delays small customer fixes.
```

Rationale: Tightened the run-on sentence by removing wordiness while preserving all background and impact points.

#### `google/gemini-4-argon` (15279 ms)

```
For the past two years, we have frozen Friday production deployments following a 2022 weekend incident. While reasonable then, this unquestioned habit now slows down sprints, pushes risky changes into busy early-week days alongside planning and support, and delays small fixes for customers.
```

Rationale: Shortened the paragraph by removing filler words while retaining all key points.

#### `anthropic/claude-haiku-5.5` (2671 ms)

```
For the past two years we have frozen all production deployments on Fridays. The rule followed a painful weekend incident in 2022 and was reasonable then, but it has become a habit nobody questions. It slows every sprint, pushes risky changes early in the week when the team is already stretched by planning and support, and delays small fixes customers are waiting for.
```

Rationale: The rewrite cuts filler and repetition while keeping the rule, its origin, and its costs.

#### `openai/gpt-6.1-terra` (2407 ms)

```
For the past two years, we have frozen Friday production deployments after a painful weekend incident in 2022. Reasonable at the time, the rule has become an unquestioned habit that slows every sprint, pushes risky changes into a week already crowded with planning and support, and delays the small fixes customers are waiting for.
```

Rationale: Shortened the paragraph while preserving its key points.

#### `anthropic/claude-sonnet-5.5` (2524 ms)

```
For the past two years our team has frozen production deployments on Fridays, a rule introduced after a painful weekend incident in 2022. It was reasonable then, but it has become an unquestioned habit that slows every sprint, pushes risky changes into the early week when the team is already stretched by planning and support, and makes it harder to ship the small fixes customers are waiting for.
```

Rationale: Condensed the long sentence into two shorter ones, cutting filler while keeping every key point.


### Clearer (p8)

**Original**

```
- Tests are passing on the main branch
- Get a review from a second engineer
- Rollback plan, you must write one in the pull request.
- No deploys during the on-call handover
```

#### `z-ai/glm-5.3-flash` (1799 ms)

```
- Tests are passing on the main branch
- A second engineer has reviewed the change
- A rollback plan is written in the pull request
- No deploys during the on-call handover
```

Rationale (not in English): Vervangt de inconsistente formulering 'Rollback plan, you must write one' door volledige zinnen in dezelfde actieve vorm, zodat alle items even leesbaar zijn.

#### `deepseek/deepseek-v4.1-flash` (1426 ms)

```
- All tests pass on the main branch
- Your pull request is reviewed by a second engineer
- You must write a rollback plan in the pull request
- No deployments during the on-call handover
```

Rationale (not in English): Die Punkte sind nun parallel formuliert und der unklare Satzbau beim Rollback-Plan wurde geglättet, ohne die Bedeutung zu ändern.

#### `qwen/qwen3.8-flash` (18550 ms)

```
- The tests are passing on the main branch.
- A second engineer has reviewed the pull request.
- The pull request includes a rollback plan.
- The deploy does not occur during the on-call handover.
```

Rationale: The items are rewritten as clear, parallel conditions while keeping the same meaning and level of detail.

#### `google/gemini-3.5-flash-lite` (2101 ms)

```
- Tests must be passing on the main branch.
- You must get a review from a second engineer.
- You must include a rollback plan in the pull request.
- There are no deploys during the on-call handover.
```

Rationale: Improved clarity and consistency of the bullet points.

#### `google/gemini-3.8-flash` (6501 ms)

```
- Tests pass on the main branch
- A second engineer reviews and approves the pull request
- A rollback plan is documented in the pull request
- The deployment does not occur during the on-call handover
```

Rationale: Standardized the list items with consistent parallel phrasing for better readability.

#### `google/gemini-4-argon` (5628 ms)

```
- Tests are passing on the main branch.
- A second engineer has reviewed the changes.
- A rollback plan is written in the pull request.
- No on-call handover is in progress.
```

Rationale: Rewrote the list items using a parallel structure to match the introductory sentence.

#### `anthropic/claude-haiku-5.5` (2410 ms)

```
- All tests pass on the main branch
- A second engineer reviews the change
- Write a rollback plan in the pull request
- Do not deploy during the on-call handover
```

Rationale: The list items now use complete, parallel sentences, which makes each condition easier to scan and follow.

#### `openai/gpt-6.1-terra` (1843 ms)

```
- Tests are passing on the main branch.
- A second engineer has reviewed the pull request.
- A rollback plan is written in the pull request.
- The deployment is not during the on-call handover.
```

Rationale: Makes the conditions consistent and easier to follow.

#### `anthropic/claude-sonnet-5.5` (2100 ms)

```
- Tests are passing on the main branch.
- A second engineer has reviewed the change.
- The pull request includes a rollback plan.
- The deploy is not during the on-call handover.
```

Rationale: Made the list items parallel in structure and wording so each condition reads clearly.


### More formal (p5)

**Original**

```
Honestly, the old freeze was a total pain and everyone kinda hated it. So we're ditching it, no big deal, but please don't be that person who pushes a huge change at 5pm on Friday and then vanishes for the weekend lol.
```

#### `z-ai/glm-5.3-flash` (1838 ms)

```
For these reasons, we are discontinuing the Friday freeze. However, please continue to exercise good judgment: avoid pushing substantial changes late on a Friday, and remain available to monitor the deployment afterward.
```

Rationale (not in English): Sostituisce il tono colloquiale con una formulazione formale e professionale, mantenendo intatti il significato e il livello di dettaglio.

#### `deepseek/deepseek-v4.1-flash` (2480 ms)

```
To be candid, the previous freeze was a considerable burden and was widely unpopular. We are therefore removing it, which is a routine change, but we ask that you not be the person who deploys a large change at 5 p.m. on a Friday and then becomes unavailable for the rest of the weekend.
```

Rationale: The informal, colloquial phrasing is rewritten in a formal, professional register while preserving the same points and level of detail.

#### `qwen/qwen3.8-flash` (14047 ms)

```
In everyday use, the previous Friday deployment freeze caused significant friction and was broadly perceived as unhelpful. We are therefore retiring it as part of this process update. Deployers should still avoid making substantial last-minute changes late on a Friday, and should remain available to support releases through the weekend where necessary.
```

Rationale: The replacement uses a formal, professional tone while preserving the original meaning and level of detail.

#### `google/gemini-3.5-flash-lite` (1802 ms)

```
While the previous freeze policy was implemented as a necessary safeguard, it now introduces unnecessary friction into our release cycles. We are therefore removing this restriction, though we strongly advise against initiating significant deployments late on Friday afternoons.
```

Rationale: Updated the tone to be more formal and professional while retaining the core message.

#### `google/gemini-3.8-flash` (4256 ms)

```
In practice, the policy created significant friction across the team. Consequently, we are lifting the restriction; however, engineers should continue to exercise good judgment and avoid deploying large, unmonitored changes late on a Friday afternoon.
```

Rationale: Revised the informal language to a professional and formal tone while retaining the original message.

#### `google/gemini-4-argon` (5167 ms)

```
The previous deployment freeze created unnecessary friction for the team, so we are retiring it. However, please continue to exercise good judgment and avoid deploying large changes at 5:00 PM on a Friday before signing off for the weekend.
```

Rationale: Replaced casual slang and phrasing with professional language while preserving the core message and specific example.

#### `anthropic/claude-haiku-5.5` (5076 ms)

```
The previous freeze was a considerable burden, and many team members found it frustrating. We are therefore discontinuing it. However, we ask that no one deploy a large change at the end of the working day on Friday and then become unavailable over the weekend.
```

Rationale: The rewrite replaces colloquial wording with formal phrasing while keeping the same message and level of detail.

#### `openai/gpt-6.1-terra` (4368 ms)

```
The previous freeze was inconvenient and generally unpopular, so we are removing it. However, please avoid deploying a major change at 5 p.m. on Friday and then becoming unavailable for the weekend.
```

Rationale: The wording is more professional while preserving the original meaning and detail.

#### `anthropic/claude-sonnet-5.5` (2145 ms)

```
The Friday freeze was widely seen as a significant inconvenience, and it has therefore been discontinued. However, we ask that team members exercise good judgment: please avoid deploying large changes late on Friday afternoon and then becoming unavailable for the weekend.
```

Rationale: Rewrote the passage in a formal, professional tone while preserving its meaning and level of detail.


### Fix grammar (p12)

**Original**

```
Once the canary looks healthy, you will recieve a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

#### `z-ai/glm-5.3-flash` (1063 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.

```

Rationale: Fixes the spelling error 

#### `deepseek/deepseek-v4.1-flash` (1736 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale (not in English): Corrige a grafia de "recieve" para "receive".

#### `qwen/qwen3.8-flash` (7918 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of “receive”.

#### `google/gemini-3.5-flash-lite` (1518 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of 'recieve' to 'receive'.

#### `google/gemini-3.8-flash` (6960 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of "receive".

#### `google/gemini-4-argon` (14982 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of "receive".

#### `anthropic/claude-haiku-5.5` (1729 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the misspelling "recieve" to "receive".

#### `openai/gpt-6.1-terra` (1837 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of “receive.”

#### `anthropic/claude-sonnet-5.5` (2144 ms)

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

Rationale: Corrected the spelling of "recieve" to "receive".


## Review pass

### Review pass

Blocks each model chose to edit:

| Block | Kind | `z-ai/glm-5.3-flash` | `deepseek/deepseek-v4.1-flash` | `qwen/qwen3.8-flash` | `google/gemini-3.5-flash-lite` | `google/gemini-3.8-flash` | `google/gemini-4-argon` | `anthropic/claude-haiku-5.5` | `openai/gpt-6.1-terra` | `anthropic/claude-sonnet-5.5` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| p1 | heading |  |  |  |  |  |  |  |  |  |
| p2 | heading |  |  |  |  |  |  |  |  |  |
| p3 | paragraph | edited | edited |  |  | edited | edited | edited | edited | edited |
| p4 | paragraph |  |  |  |  |  |  |  |  |  |
| p5 | paragraph | edited | edited |  | edited | edited | edited | edited | edited | edited |
| p6 | heading |  |  |  |  |  |  |  |  |  |
| p7 | paragraph |  |  |  |  |  |  |  |  |  |
| p8 | list | edited | edited |  | edited | edited | edited | edited | edited | edited |
| p9 | paragraph | edited | edited |  | edited | edited | edited |  | edited | edited |
| p10 | paragraph |  |  |  |  |  |  |  |  |  |
| p11 | code |  |  |  |  |  |  |  |  |  |
| p12 | paragraph | edited | edited |  | edited | edited | edited | edited | edited | edited |
| p13 | paragraph |  |  |  |  |  |  |  |  |  |

<details>
<summary>Document Blocks sent to the models</summary>

**p1** (heading)

```
# Release process update: weekday deploys
```

**p2** (heading)

```
## Why we are changing
```

**p3** (paragraph)

```
For the past two years our team has frozen all production deployments on Fridays, a rule introduced after a painful weekend incident in 2022 that was entirely reasonable at the time but has since hardened into a habit nobody questions, even though it slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are actually waiting for.
```

**p4** (paragraph)

```
Our pipeline has changed a lot since then. Every deploy now runs automated smoke tests, rolls out to ten percent of traffic first, and reverts itself if the error rate rises. The Friday freeze no longer protects us from much.
```

**p5** (paragraph)

```
Honestly, the old freeze was a total pain and everyone kinda hated it. So we're ditching it, no big deal, but please don't be that person who pushes a huge change at 5pm on Friday and then vanishes for the weekend lol.
```

**p6** (heading)

```
## What changes
```

**p7** (paragraph)

```
Starting on the first of next month, you may deploy on any weekday, as long as the following conditions are met:
```

**p8** (list)

```
- Tests are passing on the main branch
- Get a review from a second engineer
- Rollback plan, you must write one in the pull request.
- No deploys during the on-call handover
```

**p9** (paragraph)

```
All deploys need a reviewed pull request. Nothing may be deployed without a review. Every deployment has to be approved by a reviewer first.
```

**p10** (paragraph)

```
To start a canary rollout, run the deploy script from the repository root:
```

**p11** (code)

````
```bash
./scripts/deploy --env production --canary 10
./scripts/deploy --status
```
````

**p12** (paragraph)

```
Once the canary looks healthy, you will recieve a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```

**p13** (paragraph)

```
If you have questions about the new process, ask in the #releases channel or contact Priya on the platform team.
```

</details>

#### `z-ai/glm-5.3-flash` (3221 ms, first Suggestion at 2280 ms)

**p5**: The original block used an overly casual, unprofessional tone that clashes with the rest of the document.

```
The old freeze was inconvenient and unpopular, so we are retiring it. That said, please do not push a large change late on a Friday and then be unreachable over the weekend.
```

**p3**: The original was a single unwieldy sentence; splitting it improves readability and clarity.

```
For the past two years, our team has frozen all production deployments on Fridays. The rule was introduced after a painful weekend incident in 2022 and was entirely reasonable at the time, but it has since hardened into a habit nobody questions. It slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are waiting for.
```

**p8**: The list items mixed styles (declarative, imperative, fragments); they are now parallel and grammatically consistent.

```
- Tests pass on the main branch
- A second engineer has reviewed the change
- A rollback plan is written in the pull request
- No deploys during the on-call handover
```

**p9**: The third sentence merely repeated the first two; the block was trimmed to remove redundancy.

```
All deploys require a reviewed pull request. Nothing may be deployed without a reviewer's approval.
```

**p12**: Corrected the spelling error "recieve".

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `deepseek/deepseek-v4.1-flash` (5078 ms, first Suggestion at 4204 ms)

**p5** (rationale not in English): Der Absatz war zu umgangssprachlich und wird auf einen sachlichen Ton gebracht.

```
The freeze has outlived its purpose, so we are retiring it. Please use good judgement: avoid pushing a large change late on a Friday and then leaving it unattended over the weekend.
```

**p9** (rationale not in English): Die dreifache Wiederholung derselben Aussage wird auf einen Satz reduziert.

```
Every deploy requires a reviewed pull request.
```

**p8** (rationale not in English): Die Aufzählungspunkte werden grammatikalisch parallel formuliert.

```
- Tests pass on the main branch
- A second engineer reviews the change
- The pull request includes a rollback plan
- No deploys during the on-call handover
```

**p3** (rationale not in English): Der überlange Schachtelsatz wird in klarere Sätze aufgeteilt.

```
For the past two years our team has frozen all production deployments on Fridays. The rule was introduced after a painful weekend incident in 2022 and was entirely reasonable at the time. Since then it has hardened into a habit nobody questions, even though it slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes customers are waiting for.
```

**p12** (rationale not in English): Rechtschreibfehler "recieve" wird zu "receive" korrigiert.

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `qwen/qwen3.8-flash`

failed: timeout (The operation was aborted due to timeout)

#### `google/gemini-3.5-flash-lite` (2183 ms, first Suggestion at 1544 ms)

**p5**: Improve tone consistency and professionalism.

```
We are therefore removing the Friday deploy freeze. Please continue to exercise good judgment and avoid pushing major changes right before the weekend.
```

**p8**: Improve parallelism in the list items.

```
- Tests are passing on the main branch
- Review from a second engineer obtained
- Rollback plan included in the pull request
- No deploys during the on-call handover
```

**p9**: Remove redundant and repetitive sentences.

```
All deployments require a reviewed pull request before they can be released.
```

**p12**: Fix spelling of receive.

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `google/gemini-3.8-flash` (6451 ms, first Suggestion at 4439 ms)

**p5**: Adjust tone to remain professional and consistent with the rest of the document.

```
We are retiring the Friday freeze, but please continue to exercise good judgment. Avoid pushing major changes late on Friday afternoon or deploying right before leaving for the weekend.
```

**p9**: Eliminate repetitive phrasing and make the statement concise.

```
All deployments require an approved pull request with at least one review.
```

**p8**: Make the list items grammatically parallel and clear.

```
- Tests pass on the main branch
- An approval is obtained from a second engineer
- A rollback plan is documented in the pull request
- No deployments occur during the on-call handover
```

**p3**: Break up an overly long run-on sentence to improve readability.

```
For the past two years, our team has frozen all production deployments on Fridays. While this rule was introduced after a painful weekend incident in 2022, it has become an unquestioned habit. It slows down sprints, pushes risky changes into already busy early-week periods, and delays shipping small fixes customers need.
```

**p12**: Fix the spelling of "receive".

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `google/gemini-4-argon` (7973 ms, first Suggestion at 4991 ms)

**p5**: Adjust the informal tone to match the professional style of the rest of the document.

```
We are lifting the Friday freeze, though we still ask everyone to exercise good judgment. Avoid deploying large changes late on Friday afternoon when you will not be around to monitor them.
```

**p9**: Remove repetitive sentences that state the same rule three times.

```
All deployments require an approved pull request.
```

**p3**: Break the long run-on sentence into three shorter sentences for better readability.

```
For the past two years, our team has frozen all production deployments on Fridays. This rule was a reasonable response to a painful weekend incident in 2022, but it has since hardened into an unquestioned habit. Today, it slows down every sprint, pushes risky changes into the early week when the team is busy with planning and support, and delays small fixes that customers are waiting for.
```

**p8**: Rewrite the list items to use parallel grammatical structure.

```
- Tests are passing on the main branch
- A second engineer has reviewed the change
- A rollback plan is documented in the pull request
- The on-call handover is not in progress
```

**p12**: Fix the spelling of "receive".

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `anthropic/claude-haiku-5.5` (3194 ms, first Suggestion at 2067 ms)

**p3**: Splits a very long sentence into shorter ones for clarity.

```
For the past two years, our team has frozen all production deployments on Fridays. The rule was introduced after a painful weekend incident in 2022 and was reasonable at the time, but it has since become a habit nobody questions. It slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes customers are waiting for.
```

**p5**: Makes the tone consistent with the rest of the document and removes informal wording.

```
Honestly, the old freeze was a real pain, and everyone disliked it. So we're dropping it. That said, please don't be the person who pushes a huge change at 5pm on Friday and then disappears for the weekend.
```

**p8**: Makes the list items parallel and fixes the grammar of the conditions.

```
- Tests are passing on the main branch
- A second engineer has reviewed the change
- A rollback plan is written in the pull request
- No deploys during the on-call handover
```

**p12**: Corrects the spelling of "receive".

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `openai/gpt-6.1-terra` (5549 ms, first Suggestion at 1627 ms)

**p5**: Replaces informal, dismissive language with a consistent professional tone.

```
We are removing the Friday freeze, but please avoid deploying large changes late on Friday and leaving them unattended over the weekend.
```

**p8**: Makes the requirements clear and grammatically consistent.

```
- Tests must pass on the main branch
- A second engineer must review the change
- A rollback plan must be included in the pull request
- Deploys must not occur during the on-call handover
```

**p3**: Breaks up a long sentence for clarity while preserving its meaning.

```
For the past two years, our team has frozen all production deployments on Fridays. The rule was introduced after a painful weekend incident in 2022 and was reasonable at the time, but it has since become an unquestioned habit. It slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are waiting for.
```

**p9**: Removes repetition while retaining the review and approval requirements.

```
All deployments require a reviewed and approved pull request.
```

**p12**: Corrects a spelling error.

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```


#### `anthropic/claude-sonnet-5.5` (4324 ms, first Suggestion at 2266 ms)

**p3**: Splits an overlong sentence into several clearer ones.

```
For the past two years our team has frozen all production deployments on Fridays. The rule was introduced after a painful weekend incident in 2022 and was entirely reasonable at the time, but it has since hardened into a habit nobody questions. It slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are waiting for.
```

**p5**: Aligns the tone with the rest of the document and removes slang.

```
The Friday freeze is therefore ending. Please use good judgment: avoid pushing a large change late on Friday afternoon and then going offline for the weekend.
```

**p8**: Makes the list items grammatically parallel.

```
- Tests are passing on the main branch
- A second engineer has reviewed the change
- The pull request includes a rollback plan
- No deploys during the on-call handover
```

**p9**: Removes redundant sentences that repeat the same rule.

```
Every deploy needs a reviewed pull request, approved by a reviewer before deployment.
```

**p12**: Fixes the spelling of "receive".

```
Once the canary looks healthy, you will receive a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.
```



## All AI call records

<details>
<summary>One row per model call, retries included</summary>

| Task | Model requested | Served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid | Generation id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bake-off: Shorter on p3 | z-ai/glm-5.3-flash | z-ai/glm-5.3-flash-20260826 · Cohere | 451 / 176 / 50 / 0 | 0.000156 | 1660 / 388 / 926 | stop | valid | gen-1793193344-zX7T2n2j8mXvCgLgMDI9 |
| Bake-off: Clearer on p8 | z-ai/glm-5.3-flash | z-ai/glm-5.3-flash-20260826 · InferenceNet | 361 / 96 / 1 / 256 | 0.000053 | 1799 / 752 / 1567 | stop | valid | gen-1793193345-uSxVBficY80pzZzfSMH1 |
| Bake-off: More formal on p5 | z-ai/glm-5.3-flash | z-ai/glm-5.3-flash-20260826 · InferenceNet | 465 / 89 / 1 / 0 | 0.000081 | 1837 / 708 / 1609 | stop | valid | gen-1793193347-rjIWCUT6FO5ggBwqKGOv |
| Bake-off: Fix grammar on p12 | z-ai/glm-5.3-flash | z-ai/glm-5.3-flash-20260826 · DigitalOcean | 347 / 61 / 0 / 128 | 0.000059 | 1062 / 511 / 782 | stop | valid | gen-1793193349-EYxDpMSn0soCMV1prNW5 |
| Bake-off: Review pass (no Focus) | z-ai/glm-5.3-flash | z-ai/glm-5.3-flash-20260826 · Cohere | 871 / 580 / 206 / 0 | 0.000421 | 3220 / 521 / 2871 (first 2279) | stop | valid | gen-1793193350-TBBdplSeMmXon7Al7atX |
| Bake-off: Shorter on p3 | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · AtlasCloud | 592 / 306 / 205 / 512 | 0.000183 | 3334 / 1305 / 3070 | stop | valid | gen-1793193353-eEqob5SReB5XNcvUsz5t |
| Bake-off: Clearer on p8 | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · Fireworks | 503 / 221 / 130 / 374 | 0.000214 | 1426 / 517 / 1137 | stop | valid | gen-1793193356-o3mCKznUsPG25YtcZhGG |
| Bake-off: More formal on p5 | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · Relace | 489 / 241 / 141 / 0 | 0.000155 | 2480 / 1311 / 2195 | stop | valid | gen-1793193358-T1G1ya9ICyZrPVz1H4xR |
| Bake-off: Fix grammar on p12 | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · Relace | 372 / 83 / 17 / 0 | 0.000068 | 1735 / 1024 / 1550 | stop | valid | gen-1793193360-QFM7w0UQ6nszZukJpbjG |
| Bake-off: Review pass (no Focus) | deepseek/deepseek-v4.1-flash | deepseek/deepseek-v4.1-flash-20260910 · PrimeIntellect | 1106 / 1002 / 614 / 1024 | 0.001233 | 5078 / 1297 / 4805 (first 4204) | stop | valid | gen-1793193362-WLJmTecMfbIv4WtBeKPz |
| Bake-off: Shorter on p3 | qwen/qwen3.8-flash | qwen/qwen3.8-flash-20260826 · Alibaba | 512 / 498 / 387 / 512 | 0.000242 | 13239 / 4799 / 12956 | stop | valid | gen-1793193367-KZ2G1NYt2KSR8c9cv4k0 |
| Bake-off: Clearer on p8 | qwen/qwen3.8-flash | qwen/qwen3.8-flash-20260826 · Alibaba | 421 / 1116 / 1034 / 256 | 0.000553 | 18550 / 969 / 18306 | stop | valid | gen-1793193380-d7G2xPfW1a8xWYqrF9Ae |
| Bake-off: More formal on p5 | qwen/qwen3.8-flash | qwen/qwen3.8-flash-20260826 · Alibaba | 527 / 796 / 698 / 512 | 0.000385 | 14047 / 882 / 13811 | stop | valid | gen-1793193399-71NOYvrHEXPt37WB8hs2 |
| Bake-off: Fix grammar on p12 | qwen/qwen3.8-flash | qwen/qwen3.8-flash-20260826 · Alibaba | 407 / 396 / 332 / 256 | 0.000213 | 7918 / 822 / 7659 | stop | valid | gen-1793193413-X7Capg85rfw9hbWTVjHg |
| Bake-off: Review pass (no Focus) | qwen/qwen3.8-flash | – | – / – / – / – | – | 60007 / – / – | – | error: timeout | – |
| Bake-off: Shorter on p3 | google/gemini-3.5-flash-lite | google/gemini-3.5-flash-lite-20260721 · Google | 570 / 67 / 0 / 0 | 0.000338 | 1824 / 1132 / 1455 | stop | valid | gen-1793193481-pxzSEaI2z9AuBOS0NzL1 |
| Bake-off: Clearer on p8 | google/gemini-3.5-flash-lite | google/gemini-3.5-flash-lite-20260721 · Google | 478 / 73 / 0 / 0 | 0.000326 | 2101 / 1625 / 1925 | stop | valid | gen-1793193483-b2ymQfA8FbeKb3VMFoUr |
| Bake-off: More formal on p5 | google/gemini-3.5-flash-lite | google/gemini-3.5-flash-lite-20260721 · Google | 585 / 73 / 0 / 0 | 0.000358 | 1802 / 1184 / 1607 | stop | valid | gen-1793193485-JIUBclf4iQQ7OxHjnmMF |
| Bake-off: Fix grammar on p12 | google/gemini-3.5-flash-lite | google/gemini-3.5-flash-lite-20260721 · Google | 461 / 64 / 0 / 0 | 0.000298 | 1518 / 1069 / 1289 | stop | valid | gen-1793193487-vycHd1ZNFyvHx1aiEhjh |
| Bake-off: Review pass (no Focus) | google/gemini-3.5-flash-lite | google/gemini-3.5-flash-lite-20260721 · Google | 1107 / 267 / 0 / 0 | 0.001000 | 2183 / 1159 / 1880 (first 1544) | stop | valid | gen-1793193488-AubwrfFfN9cHy0zsC3XE |
| Bake-off: Shorter on p3 | google/gemini-3.8-flash | google/gemini-3.8-flash-20260902 · Google | 570 / 87 / 0 / 0 | 0.000754 | 3368 / 2187 / 3139 | stop | valid | gen-1793193490-LbfEwALgDq0g4MUiTCuL |
| Bake-off: Clearer on p8 | google/gemini-3.8-flash | google/gemini-3.8-flash-20260902 · Google | 478 / 505 / 431 / 0 | 0.002252 | 6501 / 3481 / 6300 | stop | valid | gen-1793193494-jvU15HrUn0sRAPazDOFG |
| Bake-off: More formal on p5 | google/gemini-3.8-flash | google/gemini-3.8-flash-20260902 · Google | 585 / 77 / 0 / 0 | 0.000727 | 4255 / 3326 / 4043 | stop | valid | gen-1793193500-jJUVO32P2MsP6SSl8Su1 |
| Bake-off: Fix grammar on p12 | google/gemini-3.8-flash | google/gemini-3.8-flash-20260902 · Google | 461 / 134 / 73 / 0 | 0.000848 | 6960 / 4386 / 4889 | stop | valid | gen-1793193506-VkTdaJ1bAWT5jD6XC8WE |
| Bake-off: Review pass (no Focus) | google/gemini-3.8-flash | google/gemini-3.8-flash-20260902 · Google | 1107 / 401 / 0 / 0 | 0.002334 | 6451 / 2418 / 5142 (first 4439) | stop | valid | gen-1793193512-BDq4ggNztUaKpEI94bID |
| Bake-off: Shorter on p3 | google/gemini-4-argon | google/gemini-4-argon-20261013 · Google AI Studio | 709 / 95 / 0 / 0 | 0.002368 | 15279 / 3619 / 4298 | stop | valid | gen-1793193518-z6RjRSXadpriP1Sb5Us3 |
| Bake-off: Clearer on p8 | google/gemini-4-argon | google/gemini-4-argon-20261013 · Google | 616 / 88 / 0 / 0 | 0.002112 | 5627 / 4710 / 5444 | stop | valid | gen-1793193533-0ozLeOUjFSmz2NgOWnD1 |
| Bake-off: More formal on p5 | google/gemini-4-argon | google/gemini-4-argon-20261013 · Google | 725 / 96 / 0 / 0 | 0.002410 | 5167 / 4110 / 4935 | stop | valid | gen-1793193539-6BweoGVwmUbgCyzY1u5f |
| Bake-off: Fix grammar on p12 | google/gemini-4-argon | google/gemini-4-argon-20261013 · Google AI Studio | 600 / 69 / 0 / 0 | 0.001890 | 14982 / 3802 / 4219 | stop | valid | gen-1793193544-1yU75vr0EbIUWCxxoRkF |
| Bake-off: Review pass (no Focus) | google/gemini-4-argon | google/gemini-4-argon-20261013 · Google | 1244 / 367 / 0 / 0 | 0.006158 | 7973 / 3778 / 7775 (first 4991) | stop | valid | gen-1793193559-NuIrjzgxohlb2pXXBJwS |
| Bake-off: Shorter on p3 | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5-20261007 · Azure | 970 / 156 / 0 / 0 | 0.000175 | 2671 / 1788 / 2453 | stop | valid | gen-1793193567-VDD3ga1GY7UJU1TgDn1I |
| Bake-off: Clearer on p8 | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5-20261007 · Azure | 817 / 103 / 0 / 0 | 0.000133 | 2410 / 1686 / 2154 | stop | valid | gen-1793193570-XwrdVP3dCoqSTtgku7Rt |
| Bake-off: More formal on p5 | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5-20261007 · Azure | 987 / 126 / 0 / 0 | 0.000162 | 5076 / 1722 / 2291 | stop | valid | gen-1793193574-7DJEkhlg2bfcFPhfKOKI |
| Bake-off: Fix grammar on p12 | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5-20261007 · Azure | 805 / 100 / 0 / 0 | 0.000131 | 1729 / 1175 / 1558 | stop | valid | gen-1793193577-HOg0Mg6fiHJMoBqUXsHN |
| Bake-off: Review pass (no Focus) | anthropic/claude-haiku-5.5 | anthropic/claude-haiku-5.5-20261007 · Azure | 1682 / 498 / 0 / 0 | 0.000417 | 3194 / 1272 / 2992 (first 2067) | stop | valid | gen-1793193579-w9GOh8n9AfKvqxlmQgTF |
| Bake-off: Shorter on p3 | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 506 / 88 / 0 / 0 | 0.000946 | 2407 / 1893 / 2238 | stop | valid | gen-1793193582-DxarM7nMpFfLmW54Sdwu |
| Bake-off: Clearer on p8 | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 418 / 68 / 0 / 0 | 0.000758 | 1842 / 1539 / 1647 | stop | valid | gen-1793193584-OsXIiUBKBJLwDbMreqj7 |
| Bake-off: More formal on p5 | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 520 / 66 / 0 / 0 | 0.000850 | 4368 / 2116 / 2116 | stop | valid | gen-1793193588-fZRiiwfLhqC7EtTW4wlD |
| Bake-off: Fix grammar on p12 | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 403 / 58 / 0 / 0 | 0.000693 | 1837 / 1609 / 1632 | stop | valid | gen-1793193591-ot7LIHJDkWW7vFB2uZpn |
| Bake-off: Review pass (no Focus) | openai/gpt-6.1-terra | openai/gpt-6.1-terra-20261026 · OpenAI | 965 / 327 / 0 / 0 | 0.002600 | 5549 / 983 / 5283 (first 1627) | stop | valid | gen-1793193592-KzRPRr2Jb3MP6oy8Ezat |
| Bake-off: Shorter on p3 | anthropic/claude-sonnet-5.5 | anthropic/claude-sonnet-5.5-20260928 · Azure | 970 / 162 / 0 / 0 | 0.003560 | 2524 / 1238 / 2325 | stop | valid | gen-1793193598-I1IeeL1vKAr2aeYUtL7C |
| Bake-off: Clearer on p8 | anthropic/claude-sonnet-5.5 | anthropic/claude-sonnet-5.5-20260928 · Azure | 817 / 102 / 0 / 0 | 0.002654 | 2100 / 1135 / 1899 | stop | valid | gen-1793193600-XO6GZQZMV0G915hG22tt |
| Bake-off: More formal on p5 | anthropic/claude-sonnet-5.5 | anthropic/claude-sonnet-5.5-20260928 · Azure | 987 / 131 / 0 / 0 | 0.003284 | 2145 / 986 / 1962 | stop | valid | gen-1793193603-mJjpHGIMvMfYuS7RkSVc |
| Bake-off: Fix grammar on p12 | anthropic/claude-sonnet-5.5 | anthropic/claude-sonnet-5.5-20260928 · Azure | 805 / 99 / 0 / 0 | 0.002600 | 2144 / 1227 / 1904 | stop | valid | gen-1793193605-ooJ5JR9nBnmkj2khTTKv |
| Bake-off: Review pass (no Focus) | anthropic/claude-sonnet-5.5 | anthropic/claude-sonnet-5.5-20260928 · Azure | 1682 / 538 / 0 / 0 | 0.008744 | 4324 / 1000 / 4104 (first 2266) | stop | valid | gen-1793193607-iLqhpItyRfQzqRjMLKdy |

</details>
