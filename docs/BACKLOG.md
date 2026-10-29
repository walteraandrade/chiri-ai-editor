# Backlog

Reviewed at the end of slice 6, in the order I would do them. Done items are gone: the Active Suggestion no longer jumps to each new review Suggestion, and a broken answer stream has its own error text (both [PR #12](https://github.com/walteraandrade/chiri-ai-editor/pull/12)). Margin cards replaced the floating Accept / Reject / Refine toolbar on windows with room for them ([PR #16](https://github.com/walteraandrade/chiri-ai-editor/pull/16)). Refine version arrows browse and accept earlier Replacements ([#18](https://github.com/walteraandrade/chiri-ai-editor/issues/18)).

## Next

Context links point to where the related code, decision or evidence lives. A merged PR there means the item changes what that PR shipped.

| Item | Why it waits | Context |
|---|---|---|
| Undoable Reject (CodeMirror `invertedEffects`) | About 30 lines, but v1 accepts that a stray `Esc` loses a Suggestion. A Refine in flight or an error card already takes a first `Esc` before it Rejects | [ADR 0007](chiri/adr/0007-suggestion-lifecycle.md), [PR #11](https://github.com/walteraandrade/chiri-ai-editor/pull/11) |
| Harden the Review prompt | The shipped wording passes on all 9 Bake-off models, but one sentence's position made two of them return junk Replacements. Any change needs a Bake-off re-run, about US$0.056 per full run | [PR #9](https://github.com/walteraandrade/chiri-ai-editor/pull/9), [bakeoff.md](chiri/bakeoff.md) |
| Junk-guard tuning | The guard drops a Replacement under 3 words for an original over 15 words (headings exempt). That covers the junk seen in the Bake-off (`x`, "Thank you!"); other shapes would pass every check | [PR #12](https://github.com/walteraandrade/chiri-ai-editor/pull/12), [bakeoff.md](chiri/bakeoff.md) |
| Size limit for the Review pass on huge Documents | The whole Document goes on every request: about 975 input tokens for the 331-word sample, growing in proportion. Sample-sized Documents are cheap | [ADR 0006](chiri/adr/0006-context-and-prompt-rules.md), [PR #12](https://github.com/walteraandrade/chiri-ai-editor/pull/12) |
| Keyboard navigation between Suggestions | Keys act on the Suggestion under the cursor, and the cards cover v1. It matters with up to 6 open Review Suggestions | [ADR 0007](chiri/adr/0007-suggestion-lifecycle.md), [PR #12](https://github.com/walteraandrade/chiri-ai-editor/pull/12) |
| Rationale in the Document's language on cheaper models | `openai/gpt-6.1-terra` never slipped (0 of 9). `deepseek/deepseek-v4.1-flash` and `z-ai/glm-5.3-flash` still do (6 of 9 and 3 of 9 after the ADR-faithful wording), so choosing either needs a prompt or a check first | [PR #9](https://github.com/walteraandrade/chiri-ai-editor/pull/9), [ADR 0006](chiri/adr/0006-context-and-prompt-rules.md) |
| Model selector in the UI | `OPENROUTER_MODEL` covers v1, and the default is the Gate A choice | [ADR 0010](chiri/adr/0010-model-bakeoff.md) |
| Draft preview for Target requests | Its reopen rule has not fired: the chosen model's median Target latency is about 2.1 s, under the ~3 s line. It fires if a slower model is chosen | [ADR 0008](chiri/adr/0008-validated-streaming-only.md), [bakeoff.md](chiri/bakeoff.md) |
| Align the margin card with the first change | The card sits level with the Suggestion's first line, which is the start of its Block. Pasted text with single line breaks makes one long Block, so a word change several lines down leaves the card far above it (seen while testing PR #16). Anchoring to the adaptive diff's first change fixes it and rewords ADR 0007 | [ADR 0007](chiri/adr/0007-suggestion-lifecycle.md), [PR #16](https://github.com/walteraandrade/chiri-ai-editor/pull/16) |
| Keep the margin card in view at the viewport edges | The card hangs from the Suggestion's first line on a fixed side, so it stays level with it. When that line scrolls under the sticky header the card goes with it, and a Suggestion near the bottom leaves its buttons below the fold until you scroll. Letting it flip would keep it in view but leave it misaligned after scrolling. Tab still reaches the buttons and scrolls to them | [PR #16](https://github.com/walteraandrade/chiri-ai-editor/pull/16) |
| Keep the typed Refine Instruction when the card changes placement | Crossing the ~1312px width while typing a Refine Instruction rebuilds the card, which clears the box and drops focus. Needs a window resize mid-typing; keeping it means sharing the form between card views and restoring focus after mount | [PR #16](https://github.com/walteraandrade/chiri-ai-editor/pull/16) |

## Out of scope, by choice

Deploy / hosted demo · proactive AI · slash commands · split-pane before/after · chat sidebar · version history · multiple documents · real-time multi-user collaboration · mobile layout · browser end-to-end tests (the UI is checked by hand, see `chiri/verification/`).
