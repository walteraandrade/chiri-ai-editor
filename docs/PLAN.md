# Workflow

How a slice goes from issue to `main`. Read [AGENTS.md](../AGENTS.md) and [GLOSSARY.md](../GLOSSARY.md) first; open work is in [BACKLOG.md](BACKLOG.md).

## Roles

| Role | Model | Notes |
|---|---|---|
| Orchestrator | `opus` | Runs the loop below and merges PRs. |
| Implementer | `sonnet` subagent | One at a time, on the slice branch. |
| Reviewer, first pass | `opus` subagent, effort `medium` | Two axes, as in the `code-review` skill: **Standards** (against [AGENTS.md](../AGENTS.md)) and **Spec** (against the issue and its ADRs). |
| Reviewer, later passes | `sonnet` subagent | Re-checks the fixes until no real findings remain. |

Slices that touch the same files run one after another.

## Loop per slice

1. Branch from up-to-date `main` ([AGENTS.md](../AGENTS.md#git-and-prs)).
2. Implementer: TDD the pure modules the issue lists, then the UI.
3. Run the definition of done ([AGENTS.md](../AGENTS.md#definition-of-done-every-slice)): tests, Biome, build.
4. Check the acceptance criteria in a real browser or the Electron window with `agent-browser`, with screenshots.
5. Open the PR with the `pr` skill and the [template](../.github/PULL_REQUEST_TEMPLATE.md).
6. First review (`opus`, medium), fix, then re-review (`sonnet`) until clean. Note the review outcome in the PR.
7. Squash merge.
