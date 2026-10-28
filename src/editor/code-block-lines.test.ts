import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { codeBlockLineStarts } from './code-block-lines'

const createState = (doc: string): EditorState => {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  })
  ensureSyntaxTree(state, state.doc.length, 5000)
  return state
}

describe('codeBlockLineStarts', () => {
  it('returns no lines for prose', () => {
    expect(codeBlockLineStarts(createState('# Title\n\nSome text.'))).toEqual(
      [],
    )
  })

  it('covers every line of a fenced code block, fences included', () => {
    const doc = 'Intro\n\n```bash\nls\npwd\n```\n\nOutro'
    const lineStartOf = (text: string) => doc.indexOf(text)

    expect(codeBlockLineStarts(createState(doc))).toEqual([
      lineStartOf('```bash'),
      lineStartOf('ls'),
      lineStartOf('pwd'),
      doc.lastIndexOf('```'),
    ])
  })

  it('covers an unclosed fence through the end of the document', () => {
    const doc = '```\nline one\nline two'
    expect(codeBlockLineStarts(createState(doc))).toEqual([
      0,
      doc.indexOf('line one'),
      doc.indexOf('line two'),
    ])
  })

  it('returns lines for every code block in order', () => {
    const doc = '```\na\n```\n\ntext\n\n```\nb\n```'
    const starts = codeBlockLineStarts(createState(doc))
    expect(starts).toHaveLength(6)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })
})
