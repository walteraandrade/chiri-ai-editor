import { describe, expect, it, vi } from 'vitest'
import { pickFileWith } from './browser-files'

const fakeInput = () => {
  const target = Object.assign(new EventTarget(), {
    files: null as File[] | null,
    value: '',
    click: vi.fn(),
  })
  const choose = (file: File) => {
    target.files = [file]
    target.value = `C:\\fakepath\\${file.name}`
    target.dispatchEvent(new Event('change'))
  }
  return {
    input: target as unknown as HTMLInputElement,
    target,
    choose,
  }
}

describe('pickFileWith', () => {
  it('opens the dialog and resolves with the chosen file', async () => {
    const { input, target, choose } = fakeInput()
    const picked = pickFileWith(input)
    expect(target.click).toHaveBeenCalledOnce()
    const file = new File(['# Hi'], 'hi.md')
    choose(file)
    expect(await picked).toBe(file)
  })

  it('clears the input so the same file can be picked again', async () => {
    const { input, target, choose } = fakeInput()
    const picked = pickFileWith(input)
    choose(new File([''], 'a.md'))
    await picked
    expect(target.value).toBe('')
  })

  it('resolves null when the dialog is cancelled', async () => {
    const { input, target } = fakeInput()
    const picked = pickFileWith(input)
    target.dispatchEvent(new Event('cancel'))
    expect(await picked).toBeNull()
  })

  it('abandons a pick that never settled when a new one starts', async () => {
    const { input, choose } = fakeInput()
    const first = pickFileWith(input)
    const second = pickFileWith(input)
    expect(await first).toBeNull()
    const file = new File([''], 'b.md')
    choose(file)
    expect(await second).toBe(file)
  })
})
