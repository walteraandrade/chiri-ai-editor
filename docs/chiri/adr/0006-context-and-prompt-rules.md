# 0006. Context window and prompt rules

- Status: Accepted (2026-10-28)
- Source: planning session, Q18, Q26, Q27

## Context

A rewrite that ignores the surrounding tone feels pasted in. Sending the whole Document on every request costs more and invites the model to wander.

## Decision

- **Target requests and Refine:** send the Target, its Neighbors (2 Blocks before, 2 after, the document title and the current section heading, ~300–800 tokens), and the Instruction. Refine also sends the original text, previous Instructions and the latest Replacement.
- **Review pass:** send the whole Document with numbered Blocks (it must choose where to act).
- **Fixed prompt rules:**
  1. Answer in the Target's language.
  2. Change only what the Instruction needs.
  3. Do not invent facts, numbers or names.
  4. Preserve Markdown syntax (lists, links, emphasis).
  5. Rationale: one short sentence, in the Document's language.
- **Reasoning:** off or low for Quick actions, where the model allows it.

## Consequences

- Cheaper than sending the whole Document, and the Neighbors carry the tone.
- The model can miss consistency issues outside the Neighbors. That is what the Review pass is for.
- Rule 2 makes the AI timid on open Instructions like "make this better". Free text still allows big changes when the user asks for them.

## Alternatives considered

- **Target only:** cheapest, but blind to tone and topic.
- **Whole Document on every request:** best tone match, but more tokens. A size limit for huge Documents would also be needed (backlog).
