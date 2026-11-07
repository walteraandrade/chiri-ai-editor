import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  selectedEmptyLines,
  selectedRanges,
  selectionMarks,
} from './selection-marks'

const stateWith = (doc: string, selection: EditorSelection): EditorState =>
  EditorState.create({
    doc,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true)],
  })

describe('selectedRanges', () => {
  it('returns nothing for a bare cursor', () => {
    expect(selectedRanges(stateWith('abc', EditorSelection.single(1)))).toEqual(
      [],
    )
  })

  it('returns each non-empty range in order', () => {
    const state = stateWith(
      'one two three',
      EditorSelection.create([
        EditorSelection.range(8, 13),
        EditorSelection.cursor(1),
        EditorSelection.range(4, 0),
      ]),
    )
    expect(selectedRanges(state)).toEqual([
      { from: 0, to: 4 },
      { from: 8, to: 13 },
    ])
  })
})

describe('selectedEmptyLines', () => {
  const doc = 'one\n\ntwo\n\n'

  it('returns the start of each empty line a range covers', () => {
    expect(
      selectedEmptyLines(stateWith(doc, EditorSelection.single(0, 8))),
    ).toEqual([4])
  })

  it('leaves out an empty line where the range only ends', () => {
    expect(
      selectedEmptyLines(stateWith(doc, EditorSelection.single(0, 4))),
    ).toEqual([])
  })
})

const marksOf = (state: EditorState) => {
  const found: { from: number; to: number }[] = []
  state.field(selectionMarks).between(0, state.doc.length, (from, to) => {
    found.push({ from, to })
  })
  return found
}

describe('selectionMarks', () => {
  it('clears when the selection collapses and maps when text changes', () => {
    const selected = EditorState.create({
      doc: 'alpha beta',
      selection: { anchor: 6, head: 10 },
      extensions: [selectionMarks],
    })
    expect(marksOf(selected)).toEqual([{ from: 6, to: 10 }])
    const shifted = selected.update({ changes: { from: 0, insert: '>> ' } })
    expect(marksOf(shifted.state)).toEqual([{ from: 9, to: 13 }])
    const cleared = selected.update({ selection: { anchor: 2 } })
    expect(marksOf(cleared.state)).toEqual([])
  })

  it('marks an empty line inside the selection', () => {
    const state = EditorState.create({
      doc: 'a\n\nb',
      selection: { anchor: 0, head: 4 },
      extensions: [selectionMarks],
    })
    expect(marksOf(state)).toEqual([
      { from: 0, to: 4 },
      { from: 2, to: 2 },
    ])
  })

  it('follows the selection as it changes', () => {
    const start = EditorState.create({
      doc: 'description: Works with PDFs.',
      extensions: [selectionMarks],
    })
    const next = start.update({ selection: { anchor: 0, head: 11 } }).state
    const marks = next.field(selectionMarks)
    const found: { from: number; to: number; className: string }[] = []
    marks.between(0, next.doc.length, (from, to, value) => {
      found.push({ from, to, className: value.spec.class })
    })
    expect(found).toEqual([{ from: 0, to: 11, className: 'cm-selected-text' }])
  })
})
