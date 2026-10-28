import { getQuickAction, type QuickActionId } from '../ai/quick-actions'
import type { Instruction, TargetSource } from './types'

export const quickActionInstruction = (id: QuickActionId): Instruction => {
  const action = getQuickAction(id)
  return {
    type: 'quick-action',
    id: action.id,
    label: action.label,
    text: action.instruction,
  }
}

export const freeTextInstruction = (text: string): Instruction => ({
  type: 'free-text',
  text: text.trim(),
})

export const instructionLabel = (instruction: Instruction): string =>
  instruction.type === 'quick-action' ? instruction.label : instruction.text

type TaskLabelInput = {
  readonly source: TargetSource
  readonly blocks: readonly { readonly id: string }[]
  readonly instruction: Instruction
}

const blockRange = (blocks: readonly { readonly id: string }[]): string => {
  const first = blocks[0]?.id
  const last = blocks.at(-1)?.id
  return first === undefined
    ? 'document'
    : first === last
      ? first
      : `${first}–${last}`
}

export const taskLabel = ({
  source,
  blocks,
  instruction,
}: TaskLabelInput): string => {
  const where =
    source === 'selection'
      ? `select ${blockRange(blocks)}`
      : `cursor in ${blockRange(blocks)}`
  const what =
    instruction.type === 'quick-action'
      ? instruction.label
      : `free text: ${instruction.text}`
  return `${where} → ${what}`
}

export const refineTaskLabel = ({
  blocks,
  instruction,
}: Omit<TaskLabelInput, 'source'>): string =>
  `refine ${blockRange(blocks)} → ${instructionLabel(instruction)}`
