import { describe, expect, it } from 'vitest'
import { matchEdgeWhitespace } from './replacement'

describe('matchEdgeWhitespace', () => {
  it('returns the replacement untouched when the original has no edge whitespace', () => {
    expect(matchEdgeWhitespace('Hello', 'Hi there')).toBe('Hi there')
  })

  it('restores the trailing whitespace of the original', () => {
    expect(matchEdgeWhitespace('Hello world. ', 'Hi world.')).toBe('Hi world. ')
    expect(matchEdgeWhitespace('Hello\n', 'Hi')).toBe('Hi\n')
  })

  it('restores the leading whitespace of the original', () => {
    expect(matchEdgeWhitespace('  Hello', 'Hi')).toBe('  Hi')
  })

  it('replaces the edge whitespace the model added or changed', () => {
    expect(matchEdgeWhitespace('Hello', '\n\nHi \n')).toBe('Hi')
    expect(matchEdgeWhitespace(' Hello ', 'Hi\n')).toBe(' Hi ')
  })

  it('keeps inner whitespace and line breaks', () => {
    expect(matchEdgeWhitespace('- a\n- b', '- one\n- two\n')).toBe(
      '- one\n- two',
    )
  })

  it('handles an original made only of whitespace', () => {
    expect(matchEdgeWhitespace('  ', 'Hi')).toBe('  Hi')
  })

  it('treats tabs and carriage returns as edge whitespace', () => {
    expect(matchEdgeWhitespace('\t\r\nHello \t', '  Hi\n')).toBe('\t\r\nHi \t')
  })

  it('handles an empty original and an empty replacement', () => {
    expect(matchEdgeWhitespace('', ' Hi ')).toBe('Hi')
    expect(matchEdgeWhitespace(' x ', '')).toBe('  ')
  })
})
