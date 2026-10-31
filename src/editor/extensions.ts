import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  markdownKeymap,
  markdownLanguage,
  pasteURLAsLink,
} from '@codemirror/lang-markdown'
import { LanguageSupport, syntaxHighlighting } from '@codemirror/language'
import { type Extension, Prec } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { codeBlockLines } from './code-block-lines'
import { editorTheme, markdownHighlightStyle } from './theme'

// markdown() from lang-markdown eagerly bundles lang-html, lang-css and lang-javascript
export const baseExtensions: readonly Extension[] = [
  history(),
  drawSelection(),
  EditorView.lineWrapping,
  new LanguageSupport(markdownLanguage),
  Prec.high(keymap.of(markdownKeymap)),
  pasteURLAsLink,
  syntaxHighlighting(markdownHighlightStyle),
  codeBlockLines,
  keymap.of([...defaultKeymap, ...historyKeymap]),
  editorTheme,
  EditorView.contentAttributes.of({ 'aria-label': 'Document' }),
]
