# 0005. Local-only app; API key behind the Vite dev proxy

- Status: Accepted (2026-10-28)
- Source: planning session, Q4, Q8, Q22

## Context

The challenge asks for "how to run it" and says no infrastructure is needed. The OpenRouter key has a US$5 cap and must not reach the browser.

## Decision

- **Run locally only:** `pnpm dev`. No deploy.
- **Proxy:** Vite `server.proxy` (and `preview.proxy`) forwards `/api/openrouter/*` to `https://openrouter.ai/api/v1` and overwrites `Authorization` with `OPENROUTER_API_KEY` from `.env`. The browser sends a placeholder key.
- **Missing-key banner:** `vite.config` exposes only a boolean, `__HAS_OPENROUTER_KEY__`, never the key. Without a key, a fixed banner explains what to set.
- **Config:** `.env.example` lists `OPENROUTER_API_KEY` and an optional `OPENROUTER_MODEL`.

## Consequences

- No extra process to run, and the key never reaches the bundle.
- Prompts live in client code. They are not secret.
- Deploying later means replacing the proxy with a serverless function.

## Alternatives considered

- **Public deploy:** reviewers click a link, but anyone could spend the US$5, and it needs rate limiting and infrastructure.
- **Small Hono server with `/api/suggest`:** a second process and more code.
- **Key in the bundle (`VITE_OPENROUTER_KEY`):** leaks the key.
