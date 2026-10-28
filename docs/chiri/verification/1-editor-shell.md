# Slice 1: editor shell (#1)

Checked with `agent-browser` against `pnpm dev` (Vite 8, Node 22).

## Acceptance criteria

| Criterion | Result |
|---|---|
| First visit shows the sample Document and the hint | Pass ([1](img/1-1.png)) |
| Raw Markdown styled: headings, bold, italic, strikethrough, inline code, fenced code, links, dimmed marks, dark theme | Pass ([1](img/1-1.png), [2](img/1-2.png)) |
| League Spartan on the app title only, Inter elsewhere | Pass (computed `font-family` of `h1` vs `.cm-scroller`) |
| Edits persist across reload; `localStorage` holds only `chiri.document` | Pass (`Object.keys(localStorage)` is `["chiri.document"]` after typing and after reload) |
| With a key, `/api/openrouter/models` succeeds from the browser; the browser only sends a placeholder `Authorization` | Pass (200 with `Bearer placeholder`; `/api/openrouter/auth/key` also 200, so the proxy overwrote the header) |
| Without a key, the missing-key banner shows | Pass ([3](img/1-3.png), `__HAS_OPENROUTER_KEY__` is `false`; proxied call returns 401) |
| No key in the bundle | Pass (`grep -r "sk-or-" dist/` finds nothing; neither does the key value) |
| `pnpm preview` serves the same proxy | Pass (`/api/openrouter/auth/key` 200) |
| No horizontal scroll at 375 px | Pass |

## AI calls

None. The slice only exercises the proxy with `GET /models` and `GET /auth/key`, which are not generations.

## Screenshots

1. `img/1-1.png`: first visit, sample Document and hint.
2. `img/1-2.png`: styling check (bold, italic, strikethrough, inline code, link, quote, code block).
3. `img/1-3.png`: missing-key banner.
