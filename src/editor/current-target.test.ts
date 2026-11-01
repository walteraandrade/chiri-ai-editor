import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { blocksOf, currentTarget } from './current-target'

const DOC =
  '---\nname: demo\ndescription: Does a thing.\n---\n\n# Demo\n\nBody one.\n'
const BODY = DOC.indexOf('Body one.')

const stateAt = (anchor: number, head = anchor): EditorState =>
  EditorState.create({ doc: DOC, selection: { anchor, head } })

describe('currentTarget with a frontmatter', () => {
  it('has no Target for a cursor inside it', () => {
    expect(currentTarget(stateAt(0))).toBeUndefined()
    expect(currentTarget(stateAt(10))).toBeUndefined()
  })

  it('has no Target for a selection inside it', () => {
    expect(currentTarget(stateAt(4, 12))).toBeUndefined()
  })

  it('clips a selection that extends past it, Select All included', () => {
    expect(currentTarget(stateAt(4, BODY + 4))).toMatchObject({
      source: 'selection',
      from: DOC.indexOf('# Demo'),
      text: '# Demo\n\nBody',
    })
    expect(currentTarget(stateAt(0, DOC.length))).toMatchObject({
      source: 'selection',
      from: DOC.indexOf('# Demo'),
      text: '# Demo\n\nBody one.',
    })
  })

  it('keeps Targets after it', () => {
    expect(currentTarget(stateAt(BODY + 2))).toMatchObject({
      source: 'block',
      text: 'Body one.',
    })
    expect(currentTarget(stateAt(BODY, BODY + 4))).toMatchObject({
      source: 'selection',
      text: 'Body',
    })
  })
})

describe('blocksOf with a frontmatter', () => {
  it('leaves it out', () => {
    expect(blocksOf(stateAt(0)).map((block) => block.text)).toEqual([
      '# Demo',
      'Body one.',
    ])
  })
})
