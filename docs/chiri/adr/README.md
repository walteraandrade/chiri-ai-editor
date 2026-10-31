# Architecture decisions

All decisions were made in the planning session (see `ai-sessions/`), with question numbers (Qn) cited in each ADR.

| # | Decision | Status |
|---|---|---|
| [0001](0001-inline-overlay-suggestions.md) | Inline Suggestions as an overlay on a raw-Markdown CodeMirror editor | Accepted |
| [0002](0002-structured-output-app-owned-anchors.md) | Structured model output; the app owns the anchors | Accepted |
| [0003](0003-adaptive-diff.md) | Adaptive diff granularity | Accepted |
| [0004](0004-user-triggered-ai-and-review-pass.md) | User-triggered AI, plus an on-demand Review pass | Accepted |
| [0005](0005-local-only-vite-proxy.md) | Local-only app; API key behind the Vite dev proxy | Accepted |
| [0006](0006-context-and-prompt-rules.md) | Context window and prompt rules | Accepted |
| [0007](0007-suggestion-lifecycle.md) | Suggestion lifecycle | Accepted |
| [0008](0008-validated-streaming-only.md) | Stream only where each piece arrives validated | Accepted |
| [0009](0009-ai-sdk-v7.md) | AI SDK v7 instead of plain fetch | Accepted |
| [0010](0010-model-bakeoff.md) | Choose the model by Bake-off | Accepted |
| [0011](0011-open-and-save-markdown-files.md) | Open and save Markdown files | Accepted |
| [0012](0012-document-history.md) | Document History: Versions, Timeline, Full history | Accepted; storage amended by 0015 |
| [0013](0013-native-app-on-electron.md) | Native app on Electron | Accepted |
| [0014](0014-skills-on-disk.md) | Skills on disk are the source of truth | Accepted |
| [0015](0015-history-in-sqlite.md) | History in SQLite | Accepted |

Process decisions (slices, roles, gates, reviews) live in [docs/PLAN.md](../../PLAN.md).
