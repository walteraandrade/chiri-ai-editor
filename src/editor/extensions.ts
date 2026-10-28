import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { codeBlockLines } from './code-block-lines'
import { editorTheme, markdownHighlightStyle } from './theme'

export const baseExtensions: readonly Extension[] = [
  history(),
  drawSelection(),
  EditorView.lineWrapping,
  markdown({ base: markdownLanguage }),
  syntaxHighlighting(markdownHighlightStyle),
  codeBlockLines,
  keymap.of([...defaultKeymap, ...historyKeymap]),
  editorTheme,
  EditorView.contentAttributes.of({ 'aria-label': 'Document' }),
]
