import type { FileFallback, FileHost } from './file-access'

const REVOKE_DELAY_MS = 30_000

const pendingPicks = new WeakMap<HTMLInputElement, () => void>()

export const browserFileHost = (): FileHost => window as Window & FileHost

export const pickFileWith = (input: HTMLInputElement): Promise<File | null> =>
  new Promise((resolve) => {
    pendingPicks.get(input)?.()
    const settle = (file: File | null): void => {
      input.removeEventListener('change', onPick)
      input.removeEventListener('cancel', abandon)
      pendingPicks.delete(input)
      resolve(file)
    }
    const onPick = (): void => {
      const file = input.files?.[0] ?? null
      input.value = ''
      settle(file)
    }
    const abandon = (): void => settle(null)
    pendingPicks.set(input, abandon)
    input.addEventListener('change', onPick)
    input.addEventListener('cancel', abandon)
    input.click()
  })

export const downloadText = (name: string, text: string): void => {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/markdown;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export const browserFileFallback = (
  getInput: () => HTMLInputElement | null,
): FileFallback => ({
  pickFile: () => {
    const input = getInput()
    return input === null ? Promise.resolve(null) : pickFileWith(input)
  },
  download: downloadText,
})
