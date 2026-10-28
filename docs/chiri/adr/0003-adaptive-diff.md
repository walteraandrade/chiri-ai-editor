# 0003. Adaptive diff granularity

- Status: Accepted (2026-10-28)
- Source: planning session, Q11

## Context

Word-level diffs are perfect for small fixes and unreadable "confetti" for rewrites. Block-level diffs are clear for rewrites and hide one-word fixes.

## Decision

Diff the original against the Replacement word by word (`diff`, `diffWords`). If the share of changed words exceeds a threshold (start at ~40%, calibrate on the sample Document), render block-level instead: the whole original struck through, the Replacement below it.

## Consequences

- Readable for both small fixes and rewrites.
- One threshold to tune, kept as a named constant with tests on both sides of it.

## Alternatives considered

- Always word-level.
- Always block-level.
