import { history, undo } from '@codemirror/commands'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { applySkillFields } from './frontmatter-commands'
import { historyEventOf } from './history-events'
import { suggestionsField } from './suggestion-field'

const BODY = '\n# Demo\n\nBody text.\n'
const SKILL = `---\nname: demo\ndescription: Does a thing.\n---\n${BODY}`

const editorOver = (doc: string, anchor = 0) => {
  let state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [history(), suggestionsField],
  })
  const transactions: ReturnType<EditorState['update']>[] = []
  return {
    handle: {
      get state() {
        return state
      },
      dispatch: (spec: TransactionSpec) => {
        const transaction = state.update(spec)
        transactions.push(transaction)
        state = transaction.state
      },
    },
    text: () => state.doc.toString(),
    selection: () => state.selection.main.head,
    transactions,
    undo: () => undo({ state, dispatch: (tr) => (state = tr.state) }),
  }
}

describe('applySkillFields', () => {
  it('changes the value and nothing else', () => {
    const editor = editorOver(SKILL)
    const plan = applySkillFields(editor.handle, { name: 'renamed' })
    expect(plan.kind).toBe('change')
    expect(editor.text()).toBe(SKILL.replace('name: demo', 'name: renamed'))
  })

  it('dispatches one transaction for an edit of both fields', () => {
    const editor = editorOver(SKILL)
    applySkillFields(editor.handle, { name: 'x', description: 'Y.' })
    expect(editor.transactions).toHaveLength(1)
  })

  it('dispatches nothing when the value is the same', () => {
    const editor = editorOver(SKILL)
    expect(applySkillFields(editor.handle, { name: 'demo' }).kind).toBe(
      'unchanged',
    )
    expect(editor.transactions).toHaveLength(0)
  })

  it('refuses a frontmatter it cannot edit and leaves the text alone', () => {
    const text = '---\nname: demo\n\n# Title\n'
    const editor = editorOver(text)
    expect(applySkillFields(editor.handle, { name: 'x' }).kind).toBe('refused')
    expect(editor.text()).toBe(text)
    expect(editor.transactions).toHaveLength(0)
  })

  it('keeps the cursor in the body where it was', () => {
    const at = SKILL.indexOf('Body text.')
    const editor = editorOver(SKILL, at)
    applySkillFields(editor.handle, { name: 'a-much-longer-name' })
    expect(editor.selection()).toBe(editor.text().indexOf('Body text.'))
  })

  it('is one undo step, and undo brings the old text back', () => {
    const editor = editorOver(SKILL)
    applySkillFields(editor.handle, { name: 'renamed' })
    editor.undo()
    expect(editor.text()).toBe(SKILL)
  })

  it('makes an edit of each field its own undo step', () => {
    const editor = editorOver(SKILL)
    applySkillFields(editor.handle, { name: 'renamed' })
    applySkillFields(editor.handle, { description: 'Another thing.' })
    editor.undo()
    expect(editor.text()).toBe(SKILL.replace('name: demo', 'name: renamed'))
    editor.undo()
    expect(editor.text()).toBe(SKILL)
  })

  it('reaches the History as an ordinary edit', () => {
    const editor = editorOver(SKILL)
    applySkillFields(editor.handle, { name: 'renamed' })
    const [transaction] = editor.transactions
    expect(transaction && historyEventOf(transaction)).toEqual({
      type: 'edited',
      text: SKILL.replace('name: demo', 'name: renamed'),
    })
  })

  it('adds frontmatter above a document that has none', () => {
    const editor = editorOver('# Title\n\nText.\n')
    applySkillFields(editor.handle, { name: 'demo' })
    expect(editor.text()).toBe('---\nname: demo\n---\n\n# Title\n\nText.\n')
  })
})
