import { describe, expect, it } from 'vitest'
import { getQuickAction } from '../ai/quick-actions'
import {
  freeTextInstruction,
  instructionLabel,
  quickActionInstruction,
  refineTaskLabel,
  taskLabel,
} from './instruction'

describe('instruction builders', () => {
  it('builds a Quick action Instruction from the catalog', () => {
    const shorter = getQuickAction('shorter')
    expect(quickActionInstruction('shorter')).toEqual({
      type: 'quick-action',
      id: 'shorter',
      label: 'Shorter',
      text: shorter.instruction,
    })
  })

  it('builds a free text Instruction and trims it', () => {
    expect(freeTextInstruction('  make it punchy  ')).toEqual({
      type: 'free-text',
      text: 'make it punchy',
    })
  })

  it('labels Instructions for display', () => {
    expect(instructionLabel(quickActionInstruction('fix-grammar'))).toBe(
      'Fix grammar',
    )
    expect(instructionLabel(freeTextInstruction('make it punchy'))).toBe(
      'make it punchy',
    )
  })
})

describe('taskLabel', () => {
  const block = (id: string) => ({ id })

  it('labels a selection with a Quick action', () => {
    expect(
      taskLabel({
        source: 'selection',
        blocks: [block('p3')],
        instruction: quickActionInstruction('shorter'),
      }),
    ).toBe('select p3 → Shorter')
  })

  it('labels a selection that spans several Blocks', () => {
    expect(
      taskLabel({
        source: 'selection',
        blocks: [block('p3'), block('p4'), block('p5')],
        instruction: quickActionInstruction('clearer'),
      }),
    ).toBe('select p3–p5 → Clearer')
  })

  it('labels the Block under the cursor with free text', () => {
    expect(
      taskLabel({
        source: 'block',
        blocks: [block('p5')],
        instruction: freeTextInstruction('make it friendlier'),
      }),
    ).toBe('cursor in p5 → free text: make it friendlier')
  })
})

describe('refineTaskLabel', () => {
  it('labels a Refine with the Block and the follow-up', () => {
    expect(
      refineTaskLabel({
        blocks: [{ id: 'p3' }],
        instruction: freeTextInstruction('make it shorter'),
      }),
    ).toBe('refine p3 → make it shorter')
  })

  it('labels a Refine over several Blocks', () => {
    expect(
      refineTaskLabel({
        blocks: [{ id: 'p3' }, { id: 'p4' }],
        instruction: freeTextInstruction('now more formal'),
      }),
    ).toBe('refine p3–p4 → now more formal')
  })
})
