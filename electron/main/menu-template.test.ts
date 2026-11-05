import { describe, expect, it, vi } from 'vitest'
import { menuTemplate } from './menu-template'

const preferencesItem = (onPreferences: () => void) => {
  const file = menuTemplate(onPreferences)[0]
  const items = Array.isArray(file?.submenu) ? file.submenu : []
  return items.find((item) => item.label === 'Preferences…')
}

describe('menuTemplate', () => {
  it('offers Preferences with its shortcut in the File menu', () => {
    expect(preferencesItem(vi.fn())?.accelerator).toBe('CmdOrCtrl+,')
  })

  it('reports a click on Preferences', () => {
    const onPreferences = vi.fn()
    const item = preferencesItem(onPreferences)
    item?.click?.(
      {} as Parameters<NonNullable<typeof item.click>>[0],
      undefined,
      {} as Parameters<NonNullable<typeof item.click>>[2],
    )
    expect(onPreferences).toHaveBeenCalledOnce()
  })

  it('keeps the Edit menu, so copy and paste still work', () => {
    expect(menuTemplate(vi.fn()).map((menu) => menu.role)).toContain('editMenu')
  })
})
