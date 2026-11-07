# 0019. User Quick actions

- Status: Accepted (2026-11-07)
- Source: issue [#83](https://github.com/walteraandrade/chiri-ai-editor/issues/83) and the maintainer's answers to its open questions
- Amends: [0017](0017-book-themes-and-solid-colors.md) (Preferences is no longer themes only)

## Context

[#71](https://github.com/walteraandrade/chiri-ai-editor/issues/71) made the ask bubble filter Quick actions as the writer types. Six are built in and three are on. The writer could not turn the others on, change the order, or add their own Instruction. `QuickActionId` was a closed union, and the Bake-off relies on it.

## Decision

- **Managed in Preferences**, in a Quick actions section under the themes, in both builds. Each row has a check mark (on or off), `↑` and `↓` to move it, and, for the writer's own actions, Edit and Delete. Delete asks once, in the row. Changes apply to the bubble at once, with no reload.
- **A user Quick action is a name and an Instruction**, and may be marked "Only in skills", which hides it outside skills like the built-in skill actions. Names are unique among all Quick actions, ignoring case, at most 40 characters; Instructions at most 2000.
- **Ids.** Built-in ids keep their closed union, `BuiltInQuickActionId`, which the Bake-off uses. User ids are `user-<uuid>`. `QuickActionId` is the union of both.
- **Built-in wording lives in the code.** Storage keeps only a built-in action's id and whether it is on, so a new wording or a new built-in action reaches every writer. A built-in action the storage misses is added at the end, turned off. Built-in actions cannot be edited or deleted.
- **Storage, per build ([0016](0016-web-and-electron-builds.md)):** the same JSON (`{ "version": 1, "actions": [...] }`, in order). Web: `localStorage` under `chiri.quickActions`. Electron: `quick-actions.json` in `userData`, through two IPC channels (`quick-actions:load`, `quick-actions:save`). The main process checks the sender, caps the text at 256 KB, parses it with the same rules as the renderer and writes what it understood, atomically.
- **Unreadable storage falls back to the defaults.** The file is left alone until the writer changes something, which overwrites it.

## Consequences

- An Instruction a writer typed goes to the model as it is, as free text already does.
- A Suggestion keeps the label and text of its Instruction, so deleting or editing a Quick action does not change Suggestions already made from it.
- Preferences is longer; the themes still come first.
- No sync between the two builds, and no import or export.

## Alternatives considered

- **A separate Quick actions dialog:** left 0017 alone, but added one more button and native menu item.
- **`localStorage` in Electron too:** less code, but the settings would sit inside Chromium's storage instead of a file in `userData`.
- **No skill-only user actions:** one field less, but a skill author could not keep their own skill actions out of other documents.
