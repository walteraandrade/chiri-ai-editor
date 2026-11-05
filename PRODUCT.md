# Product

## Register

product

## Users

One writer at a desk, editing a Markdown Document of a few pages: a release note, an announcement, an essay draft. They are mid-task and want help on a passage, not a rewrite of the whole Document. The reviewer of the Chiri assessment is the second user: they open the app cold and must get a useful Suggestion without reading docs.

## Product Purpose

A browser Markdown editor with an AI co-author. The AI proposes inline Suggestions as visible diffs; the writer accepts, rejects or refines each one. Success is a writer who keeps typing, asks for help on a passage, sees exactly what would change, and decides in one keystroke.

## Brand Personality

Calm, precise, collaborative. The AI behaves like a quiet colleague in the same Document: it shows where it is working, says why in one sentence, and steps back once the writer decides. Motion is expressive in what it shows (where the AI is, what changed, whose text it is now) and calm in how it moves: slow-out easing, no bounce, no sparkle.

## Anti-references

- A chatbot in a sidebar. The AI lives in the text, next to the words it touches.
- AI purple gradients, sparkle icons and glowing "magic" buttons.
- Glassmorphism, gradient text, neon accents.
- Motion that decorates instead of telling state: page-load choreography, bouncing chips, confetti.

## Design Principles

1. **The text is the stage.** Every AI surface sits next to the words it is about; nothing pulls the eye away from the Document.
2. **Show who is acting.** The AI has one visible identity (its caret and its name flag) wherever it acts: while thinking, in its Suggestions, in its Cards.
3. **Motion tells state.** Each animation answers a question: where is the AI working, what changed, is it mine now?
4. **The writer decides.** AI changes stay visibly provisional until accepted; accepted text settles into the writer's own ink.
5. **Any palette, exactly.** A theme is a few solid colors, painted as they are, with no tints or shadows. The writer picks one of 24 palettes in Preferences, or the Chiri theme. In dev the writer's Omarchy theme, light or dark, is one more option.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast for text, placeholders included.
- Every animation has a `prefers-reduced-motion` alternative: no travel, no loops, state shown by color alone.
- Full keyboard use: `Ctrl+K` / `Cmd+K`, `Tab` cycles inside Cards and the bubble, `Esc` returns to the text.
