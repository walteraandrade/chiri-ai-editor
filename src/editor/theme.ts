import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    fontSize: '1.85em',
    fontWeight: '700',
    color: 'var(--color-ink-strong)',
  },
  {
    tag: tags.heading2,
    fontSize: '1.5em',
    fontWeight: '650',
    color: 'var(--color-ink-strong)',
  },
  {
    tag: tags.heading3,
    fontSize: '1.25em',
    fontWeight: '600',
    color: 'var(--color-ink-strong)',
  },
  {
    tag: tags.heading4,
    fontSize: '1.1em',
    fontWeight: '600',
    color: 'var(--color-ink-strong)',
  },
  {
    tag: [tags.heading5, tags.heading6],
    fontWeight: '600',
    color: 'var(--color-ink-muted)',
  },
  { tag: tags.strong, fontWeight: '700', color: 'var(--color-ink-strong)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  {
    tag: tags.monospace,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9em',
    backgroundColor: 'var(--color-code-bg)',
    borderRadius: '4px',
    padding: '0.1em 0.3em',
  },
  { tag: tags.link, color: 'var(--color-accent)' },
  { tag: tags.url, color: 'var(--color-ink-faint)' },
  { tag: tags.quote, color: 'var(--color-ink-muted)', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: 'var(--color-ink-faint)' },
  { tag: tags.labelName, color: 'var(--color-ink-faint)' },
  { tag: tags.contentSeparator, color: 'var(--color-ink-faint)' },
  { tag: tags.comment, color: 'var(--color-ink-faint)' },
])

export const editorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-ink)',
      backgroundColor: 'transparent',
      fontSize: '1.0625rem',
      minHeight: '60vh',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--font-sans)',
      lineHeight: '1.75',
    },
    '.cm-content': {
      padding: '0.5rem 0',
      caretColor: 'var(--color-ink-strong)',
    },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-ink-strong)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
      { backgroundColor: 'var(--color-selection)' },
    '.cm-codeblock-line': {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.9em',
      backgroundColor: 'var(--color-code-bg)',
      borderInline: '0.75rem solid transparent',
    },
    '.cm-codeblock-line span': {
      backgroundColor: 'transparent',
      padding: '0',
      fontSize: 'inherit',
    },
  },
  { dark: true },
)
