import { describe, expect, it } from 'vitest'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { extractBlocks } from './extract-blocks'
import { findBlockAt, getNeighbors, headingText, resolveTarget } from './target'

const DOC = [
  '# Title',
  '',
  'Intro.',
  '',
  '## Section A',
  '',
  'A one.',
  '',
  'A two.',
  '',
  'A three.',
  '',
  '## Section B',
  '',
  'B one.',
  '',
  'B two.',
  '',
].join('\n')

const blocks = extractBlocks(DOC)
const byText = (text: string) => {
  const block = blocks.find((candidate) => candidate.text === text)
  if (!block) throw new Error(`no block ${text}`)
  return block
}

describe('findBlockAt', () => {
  it('returns the Block containing the position', () => {
    const block = byText('A two.')
    expect(findBlockAt(blocks, block.from + 2)?.id).toBe(block.id)
  })

  it('includes both edges of a Block', () => {
    const block = byText('A two.')
    expect(findBlockAt(blocks, block.from)?.id).toBe(block.id)
    expect(findBlockAt(blocks, block.to)?.id).toBe(block.id)
  })

  it('returns undefined between Blocks', () => {
    const first = byText('A one.')
    expect(findBlockAt(blocks, first.to + 1)).toBeUndefined()
  })

  it('returns undefined for an empty Document', () => {
    expect(findBlockAt([], 0)).toBeUndefined()
  })
})

describe('headingText', () => {
  it('strips ATX markers', () => {
    expect(headingText(byText('## Section A'))).toBe('Section A')
  })

  it('strips closing ATX markers', () => {
    const [block] = extractBlocks('## Closed ##\n')
    expect(block && headingText(block)).toBe('Closed')
  })

  it('drops the setext underline', () => {
    const [block] = extractBlocks('Setext title\n============\n')
    expect(block && headingText(block)).toBe('Setext title')
  })
})

describe('resolveTarget', () => {
  it('uses the selection when it is not empty', () => {
    const block = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: block.from + 2,
      to: block.from + 5,
    })
    expect(target).toMatchObject({
      source: 'selection',
      from: block.from + 2,
      to: block.from + 5,
      text: 'two',
    })
    expect(target?.blocks.map((candidate) => candidate.id)).toEqual([block.id])
  })

  it('lists every Block a selection overlaps', () => {
    const first = byText('A one.')
    const second = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: first.from + 3,
      to: second.from + 3,
    })
    expect(target?.blocks.map((candidate) => candidate.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  it('uses the Block under the cursor when nothing is selected', () => {
    const block = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: block.from + 1,
      to: block.from + 1,
    })
    expect(target).toMatchObject({
      source: 'block',
      from: block.from,
      to: block.to,
      text: 'A two.',
    })
    expect(target?.blocks).toEqual([block])
  })

  it('picks the nearest Block when the cursor sits between Blocks', () => {
    const first = byText('A one.')
    const second = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: first.to + 1,
      to: first.to + 1,
    })
    expect([first.id, second.id]).toContain(target?.blocks[0]?.id)
    expect(target?.source).toBe('block')
  })

  it('prefers the previous Block when the cursor is equidistant', () => {
    const doc = 'abc\n\ndef\n'
    const docBlocks = extractBlocks(doc)
    const target = resolveTarget(docBlocks, doc, { from: 4, to: 4 })
    expect(target?.text).toBe('abc')
  })

  it('returns undefined for an empty Document', () => {
    expect(resolveTarget([], '', { from: 0, to: 0 })).toBeUndefined()
  })

  it('returns undefined for a whitespace-only selection', () => {
    const doc = 'abc\n\n\n\ndef\n'
    const docBlocks = extractBlocks(doc)
    expect(resolveTarget(docBlocks, doc, { from: 4, to: 7 })).toBeUndefined()
  })

  it('normalises a reversed selection', () => {
    const block = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: block.from + 5,
      to: block.from + 2,
    })
    expect(target?.text).toBe('two')
  })
})

describe('getNeighbors', () => {
  const targetFor = (text: string) => {
    const block = byText(text)
    const target = resolveTarget(blocks, DOC, {
      from: block.from,
      to: block.from,
    })
    if (!target) throw new Error('no target')
    return target
  }

  it('takes 2 Blocks before and 2 after the Target', () => {
    const neighbors = getNeighbors(blocks, targetFor('A two.'))
    expect(neighbors.before.map((block) => block.text)).toEqual([
      '## Section A',
      'A one.',
    ])
    expect(neighbors.after.map((block) => block.text)).toEqual([
      'A three.',
      '## Section B',
    ])
  })

  it('returns fewer Blocks at the Document edges', () => {
    const first = getNeighbors(blocks, targetFor('# Title'))
    expect(first.before).toEqual([])
    expect(first.after.map((block) => block.text)).toEqual([
      'Intro.',
      '## Section A',
    ])
    const last = getNeighbors(blocks, targetFor('B two.'))
    expect(last.after).toEqual([])
  })

  it('reports the Document title and the current section heading', () => {
    const neighbors = getNeighbors(blocks, targetFor('B one.'))
    expect(neighbors.title).toBe('Title')
    expect(neighbors.section).toBe('Section B')
  })

  it('uses the nearest heading before the Target as the section', () => {
    const neighbors = getNeighbors(blocks, targetFor('A three.'))
    expect(neighbors.section).toBe('Section A')
  })

  it('has no section before the first heading', () => {
    const doc = 'Preamble.\n\n# Title\n\nBody.\n'
    const docBlocks = extractBlocks(doc)
    const target = resolveTarget(docBlocks, doc, { from: 0, to: 0 })
    if (!target) throw new Error('no target')
    const neighbors = getNeighbors(docBlocks, target)
    expect(neighbors.section).toBeUndefined()
    expect(neighbors.title).toBe('Title')
  })

  it('has no title when the Document has no # heading', () => {
    const doc = '## Only a subsection\n\nBody.\n'
    const docBlocks = extractBlocks(doc)
    const target = resolveTarget(docBlocks, doc, { from: 25, to: 25 })
    if (!target) throw new Error('no target')
    expect(getNeighbors(docBlocks, target).title).toBeUndefined()
  })

  it('excludes every overlapped Block from the neighbors of a selection', () => {
    const first = byText('A one.')
    const second = byText('A two.')
    const target = resolveTarget(blocks, DOC, {
      from: first.from + 3,
      to: second.from + 3,
    })
    if (!target) throw new Error('no target')
    const neighbors = getNeighbors(blocks, target)
    expect(neighbors.before.map((block) => block.text)).toEqual([
      'Intro.',
      '## Section A',
    ])
    expect(neighbors.after.map((block) => block.text)).toEqual([
      'A three.',
      '## Section B',
    ])
  })

  it('works on the sample Document', () => {
    const sampleBlocks = extractBlocks(SAMPLE_DOCUMENT)
    const slang = sampleBlocks[4]
    if (!slang) throw new Error('no block')
    const target = resolveTarget(sampleBlocks, SAMPLE_DOCUMENT, {
      from: slang.from + 10,
      to: slang.from + 10,
    })
    if (!target) throw new Error('no target')
    const neighbors = getNeighbors(sampleBlocks, target)
    expect(neighbors.title).toBe('Release process update: weekday deploys')
    expect(neighbors.section).toBe('Why we are changing')
    expect(neighbors.before.map((block) => block.id)).toEqual(['p3', 'p4'])
    expect(neighbors.after.map((block) => block.id)).toEqual(['p6', 'p7'])
  })
})
