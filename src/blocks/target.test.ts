import { describe, expect, it } from 'vitest'
import { SAMPLE_DOCUMENT } from '../document/sample-document'
import { extractBlocks } from './extract-blocks'
import {
  findBlockAt,
  getNeighbors,
  headingText,
  resolveTarget,
  targetFromRange,
} from './target'

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

  it.each([
    ['## Closed \t##  \t', 'Closed'],
    ['## Closed ###', 'Closed'],
    ['## Closed#', 'Closed#'],
    ['## A # B', 'A # B'],
    ['## A #  B #', 'A #  B'],
    ['##   ', ''],
    ['## #', '#'],
  ])('strips ATX markers from %j', (source, expected) => {
    const [block] = extractBlocks(`${source}\n`)
    expect(block && headingText(block)).toBe(expected)
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

describe('resolveTarget with line breaks at the edges of a selection', () => {
  const block = byText('A two.')

  it('drops the line break a triple-click leaves at the end', () => {
    const target = resolveTarget(blocks, DOC, {
      from: block.from,
      to: block.to + 1,
    })
    expect(target).toMatchObject({
      source: 'selection',
      from: block.from,
      to: block.to,
      text: 'A two.',
    })
    expect(target?.blocks.map((candidate) => candidate.text)).toEqual([
      'A two.',
    ])
  })

  it('drops line breaks at the start and several at the end', () => {
    const target = resolveTarget(blocks, DOC, {
      from: block.from - 2,
      to: block.to + 2,
    })
    expect(target).toMatchObject({
      from: block.from,
      to: block.to,
      text: 'A two.',
    })
    expect(target?.blocks).toHaveLength(1)
  })

  it('keeps line breaks inside the selection and spaces at the edges', () => {
    const first = byText('A one.')
    const target = resolveTarget(blocks, DOC, {
      from: first.from,
      to: block.to + 1,
    })
    expect(target?.text).toBe('A one.\n\nA two.')
    expect(resolveTarget(blocks, ' x \n', { from: 0, to: 4 })).toMatchObject({
      text: ' x ',
      from: 0,
      to: 3,
    })
  })

  it('has no Target for a selection of only line breaks', () => {
    expect(resolveTarget(blocks, DOC, { from: 7, to: 9 })).toBeUndefined()
  })
})

describe('targetFromRange', () => {
  it('rebuilds a selection Target from its range', () => {
    const block = byText('A two.')
    const rebuilt = targetFromRange(
      blocks,
      DOC,
      { from: block.from + 2, to: block.to },
      'selection',
    )
    const original = resolveTarget(blocks, DOC, {
      from: block.from + 2,
      to: block.to,
    })
    expect(rebuilt).toEqual(original)
  })

  it('rebuilds a Block Target from the Block range', () => {
    const block = byText('A two.')
    const rebuilt = targetFromRange(
      blocks,
      DOC,
      { from: block.from, to: block.to },
      'block',
    )
    expect(rebuilt).toEqual(
      resolveTarget(blocks, DOC, { from: block.from + 1, to: block.from + 1 }),
    )
  })

  it('lists every Block the range overlaps', () => {
    const first = byText('A one.')
    const second = byText('A two.')
    const rebuilt = targetFromRange(
      blocks,
      DOC,
      { from: first.from, to: second.to },
      'selection',
    )
    expect(rebuilt.blocks.map((block) => block.text)).toEqual([
      'A one.',
      'A two.',
    ])
  })
})

describe('resolveTarget with a frontmatter', () => {
  const doc =
    '---\nname: demo\ndescription: Does a thing.\n---\n\n# Demo\n\nBody one.\n\nBody two.\n'
  const docBlocks = extractBlocks(doc)
  const end = doc.indexOf('---\n\n') + 3
  const bodyOne = doc.indexOf('Body one.')
  const resolve = (from: number, to = from) =>
    resolveTarget(docBlocks, doc, { from, to })

  it('refuses a cursor anywhere inside it', () => {
    expect(resolve(0)).toBeUndefined()
    expect(resolve(8)).toBeUndefined()
    expect(resolve(doc.indexOf('description') + 4)).toBeUndefined()
    expect(resolve(end)).toBeUndefined()
  })

  it('refuses a selection inside it', () => {
    expect(resolve(6, 10)).toBeUndefined()
    expect(resolve(0, end)).toBeUndefined()
  })

  it('clips a selection that extends past it to start after it', () => {
    const target = resolve(6, bodyOne + 4)
    expect(target).toMatchObject({
      source: 'selection',
      from: doc.indexOf('# Demo'),
      to: bodyOne + 4,
      text: '# Demo\n\nBody',
    })
    expect(target?.blocks.map((block) => block.text)).toEqual([
      '# Demo',
      'Body one.',
    ])
  })

  it('clips Select All to everything after it', () => {
    const target = resolve(0, doc.length)
    expect(target).toMatchObject({
      source: 'selection',
      from: doc.indexOf('# Demo'),
      to: doc.length - 1,
      text: '# Demo\n\nBody one.\n\nBody two.',
    })
    expect(target?.blocks.map((block) => block.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('clips a reversed selection the same way', () => {
    expect(resolve(bodyOne + 4, 6)).toEqual(resolve(6, bodyOne + 4))
  })

  it('clips a selection that starts at the very beginning', () => {
    expect(resolve(0, bodyOne + 4)).toEqual(resolve(6, bodyOne + 4))
  })

  it('keeps a clipped Target out of the frontmatter', () => {
    const target = resolve(0, doc.length)
    expect(target?.from).toBeGreaterThan(end)
    expect(target?.blocks.every((block) => block.from > end)).toBe(true)
  })

  it('refuses a selection that reaches only the line breaks after it', () => {
    expect(resolve(0, end + 1)).toBeUndefined()
    expect(resolve(6, end + 2)).toBeUndefined()
  })

  it('allows a selection after it', () => {
    expect(resolve(bodyOne, bodyOne + 4)).toMatchObject({
      source: 'selection',
      text: 'Body',
    })
  })

  it('allows a selection that begins at the line break after it', () => {
    expect(resolve(end, bodyOne + 9)).toMatchObject({
      source: 'selection',
      from: doc.indexOf('# Demo'),
      text: '# Demo\n\nBody one.',
    })
  })

  it('picks the first Block for a cursor on the blank line after it', () => {
    expect(resolve(end + 1)).toMatchObject({
      source: 'block',
      text: '# Demo',
    })
  })

  it('allows a cursor in a Block after it', () => {
    expect(resolve(bodyOne + 2)).toMatchObject({
      source: 'block',
      text: 'Body one.',
    })
  })

  it('refuses everything in a Document that is only a frontmatter', () => {
    const only = '---\nname: demo\n---\n'
    const onlyBlocks = extractBlocks(only)
    const resolveOnly = (from: number, to: number) =>
      resolveTarget(onlyBlocks, only, { from, to })
    expect(resolveOnly(6, 6)).toBeUndefined()
    expect(resolveOnly(0, 18)).toBeUndefined()
    expect(resolveOnly(0, only.length)).toBeUndefined()
  })

  it('does not refuse anything for an unclosed frontmatter', () => {
    const open = '---\nname: demo\n\nBody.\n'
    expect(
      resolveTarget(extractBlocks(open), open, { from: 6, to: 6 }),
    ).toBeDefined()
  })

  it('does not put the frontmatter in the neighbors', () => {
    const target = resolve(doc.indexOf('# Demo'))
    if (!target) throw new Error('no target')
    const neighbors = getNeighbors(docBlocks, target)
    expect(neighbors.before).toEqual([])
    expect(neighbors.title).toBe('Demo')
    expect(neighbors.after.map((block) => block.text)).toEqual([
      'Body one.',
      'Body two.',
    ])
  })
})
