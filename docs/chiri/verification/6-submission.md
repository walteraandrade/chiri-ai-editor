# Slice 6 verification: submission

Issue [#6](https://github.com/walteraandrade/chiri-ai-editor/issues/6). Checked on 2026-10-28 with `agent-browser` (headless Chrome) against a fresh clone and, for the export script, against the real `~/.claude/projects/` with a temporary destination.

The real export into `ai-sessions/` is not part of this check. It runs last, after the PR text is written (Gate C), and its numbers go in the PR.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| The README instructions work from a fresh clone | Pass | See "Fresh clone" below. |
| The export matches the source byte for byte, except the masked key spans | Pass in a dry run | `pnpm export-sessions --verify` on a temporary export: 62 files, 62 identical, 0 grown, 0 different (see "Export dry run"). The temporary export was deleted. |
| A search of the export for `sk-or-` finds only masked values, and the real key value is absent | Pass in a dry run | Dry run: 0 occurrences of `sk-or-` followed by a key character, 0 occurrences of the `OPENROUTER_API_KEY` value. The same value is also absent from the source sessions. |
| Session files are not otherwise edited, summarized or reformatted | Pass in a dry run | The check above compares every exported file with its masked source. Binary files (the `.jpg` in the orchestrator session) are copied without masking and compared byte for byte. |
| The `docs/chiri/ai-costs.md` running total is up to date | Pass | US$0.269 of 5.00, from the key's usage counter and the rows. No model calls in this slice. |
| Gate C | Open | The maintainer reviews before merge. |

## Fresh clone

`git clone https://github.com/walteraandrade/chiri-ai-editor` into a temporary folder outside the repository (it holds `main` at `cc20e17`, slices 1 to 5), then:

| Step | Result |
|---|---|
| `pnpm install` | Pass, 2.3 s (the lockfile was enough, nothing to resolve) |
| `pnpm test` | Pass: 35 files, 538 tests |
| `pnpm build` | Pass. `grep -r "sk-or-" dist/` finds nothing, and neither does the value of the key |
| `pnpm dev` with `OPENROUTER_API_KEY` set in the environment (no `.env`) | The app loads, no missing-key banner, the editor renders ([6-1](img/6-1.png)). `fetch('/api/openrouter/models')` returns 200. `fetch('/api/openrouter/auth/key')` returns 200, so the proxy applied the key |
| `pnpm dev` with `OPENROUTER_API_KEY=` empty and no `.env` | The missing-key banner shows ([6-2](img/6-2.png)) |
| `pnpm dev` with `cp .env.example .env` and the key written to `.env`, variable unset | The app loads, no banner, `/models` and `/auth/key` return 200. This is the flow the README describes |

Then the slice branch was fetched into the same clone: 37 files, 603 tests pass, `pnpm biome check` clean, `pnpm build` green with no `sk-or-` in `dist/`, and `pnpm export-sessions --help` runs.

Notes:
- `GET /models` is a public OpenRouter endpoint, so it also returns 200 without a key. The banner and `/auth/key` are the signals that tell the two cases apart.
- The clone, its `.env` and the dev servers were deleted after the check. No generation call was made.

## Export dry run

`pnpm export-sessions --dest <temporary folder outside the repository>` against the real source (`~/.claude/projects/`, every folder starting with `-home-walter-Github-chiri-ai-editor`), then `pnpm export-sessions --verify` on the same folder. The folder was deleted afterwards; `ai-sessions/` was not created.

| Measure | Value |
|---|---|
| Files copied | 62, from the 2 project folders that have session files (orchestration and grilling). The other 2 matching folders hold only `memory/` or a `*.desktop-released.json` marker, which are skipped, so no session was left out |
| Bytes | 54,637,901 |
| Masked spans | 104, in 4 files (the orchestrator `.jsonl` 42, three subagent `.jsonl` files 23, 38 and 1) |
| Identical to the masked source | 62 |
| Grown since the export | 0 in this run. An earlier dry run (58 files, 27 spans) had 1: the transcript of a running subagent, whose exported part matched the masked source byte for byte. Only a `.jsonl` whose exported part is non-empty and ends with a line break may be "grown"; any other difference fails |
| Different, missing or unexpected | 0, 0, 0 |
| `sk-or-` followed by a key character in the export | 0 |
| Occurrences of the `OPENROUTER_API_KEY` value in the export | 0 |

What the 104 spans are: prose in the sessions that mentions the key prefix or a partially masked label (`sk-or-v1-`, `sk-or-v1-abc...xyz` and similar), and the test examples written during this slice. None has the shape of a real key (`sk-or-v1-` plus 64 hex characters), and the real value is not in the sources at all. The pattern masks these too, as the plan asks.

A tampered file (a byte appended to an exported `custom-title.json`) made `--verify` exit with 1.

## Final export

Run by the maintainer at Gate C (the auto-mode permission classifier blocked the orchestrator from copying `~/.claude/projects/` into the repository): `pnpm export-sessions`, then `pnpm export-sessions --verify`.

| Measure | Value |
|---|---|
| Files exported to `ai-sessions/` | 65 (2 project folders: orchestration and grilling) |
| Bytes | 55,499,875 |
| Masked spans | 118, in 5 files (orchestrator `.jsonl` 44; subagent `.jsonl` files 44, 23, 6 and 1) |
| Identical to the masked source | 64 |
| Grown since the export | 1: the orchestrator `.jsonl`, still being written; its exported part matches and ends on a line break |
| Different, missing or unexpected | 0, 0, 0 |
| `sk-or-` followed by a key character in the export | 0 |
| Occurrences of the `OPENROUTER_API_KEY` value in the export | 0 |

The orchestrator session continues after this export, so its last turns (Gate C and the merge) are not in `ai-sessions/`.

## Screenshots

1. `img/6-1.png`: fresh clone, key from the environment, no banner.
2. `img/6-2.png`: fresh clone, empty key, missing-key banner.

## AI calls

None.

| Task | Model → served by | Tokens in / out / reasoning / cached | Cost (US$) | Latency client / OpenRouter / generation (ms) | Finish | Valid |
|---|---|---|---|---|---|---|
| — | — | — | 0.00 | — | — | — |
