# Verification: user Quick actions

Issue [#83](https://github.com/walteraandrade/chiri-ai-editor/issues/83), [ADR 0019](../adr/0019-user-quick-actions.md). Checked on 2026-11-07 in both builds:
- **Web build:** `CHIRI_DEV_PORT=5383 pnpm dev` in `agent-browser`'s own Chromium.
- **Electron build:** `CHIRI_DEV_PORT=5384 CHIRI_CDP_PORT=9384 CHIRI_USER_DATA_DIR=<temp dir> pnpm dev:electron`, attached with `agent-browser connect 9384`.

No check called the model, so there are no AI call records and no cost.

| Check | Build | Result |
|---|---|---|
| Preferences lists all six built-in actions; Shorter, Clearer and Fix grammar on | Web | Pass |
| New Quick action with a name another action has ("shorter") is refused, focus on Name | Web | Pass |
| New Quick action "As steps" is added at the end, on, and stored in `chiri.quickActions` | Web | Pass |
| Moving Fix grammar to the top; focus falls to `↓` when `↑` turns disabled | Web | Pass |
| Turning Clearer off and More formal on | Web | Pass |
| The bubble lists Fix grammar, Shorter, More formal, As steps, without a reload ([83-1](img/83-1.png)) | Web | Pass |
| Typing "ste" lists only As steps and the free-text row | Web | Pass |
| After a reload, order and on/off are kept | Web | Pass |
| Edit to "Steps", Only in skills: the row shows the Skill tag ([83-2](img/83-2.png)) | Web | Pass |
| Delete asks in the row, then removes it; focus goes to New Quick action ([83-3](img/83-3.png)) | Web | Pass |
| `Esc` in the form cancels it and leaves Preferences open | Web | Pass |
| Adding an action and turning Shorter off right after both land in `quick-actions.json` | Electron | Pass after a fix |
| After a reload the bubble lists Clearer, Fix grammar, Warmer ([83-4](img/83-4.png)) | Electron | Pass |
| An unreadable `quick-actions.json` gives the defaults | Electron | Pass |

What the checks caught: two changes made before React re-rendered (add, then a toggle) wrote the second change over the first, so the new action was lost. Every change now applies to the latest settings.

Not checked in the app: a skill-only user action hidden outside a skill (unit tests in `src/ai/quick-action-settings.test.ts` cover the filter); the packaged app on `app://`. Clicks on rows below the panel's scroll were sent through `element.click()` after `agent-browser`'s pointer click missed rows outside the view.
