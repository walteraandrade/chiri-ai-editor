import { describe, expect, it, vi } from 'vitest'
import { menuTemplate } from './menu-template'

const preferencesItem = (onPreferences: () => void) => {
  const file = menuTemplate(onPreferences, vi.fn())[0]
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
    expect(menuTemplate(vi.fn(), vi.fn()).map((menu) => menu.role)).toContain(
      'editMenu',
    )
  })

  const libraryItem = (onLibrary: () => void) => {
    const view = menuTemplate(vi.fn(), onLibrary).find(
      (menu) => menu.label === 'View',
    )
    const items = Array.isArray(view?.submenu) ? view.submenu : []
    return items.find((item) => item.label === 'Library')
  }

  it('offers Library with its shortcut in the View menu', () => {
    expect(libraryItem(vi.fn())?.accelerator).toBe('CmdOrCtrl+B')
  })

  it('reports a click on Library', () => {
    const onLibrary = vi.fn()
    const item = libraryItem(onLibrary)
    item?.click?.(
      {} as Parameters<NonNullable<typeof item.click>>[0],
      undefined,
      {} as Parameters<NonNullable<typeof item.click>>[2],
    )
    expect(onLibrary).toHaveBeenCalledOnce()
  })

  it('keeps the View menu items it replaced', () => {
    const view = menuTemplate(vi.fn(), vi.fn()).find(
      (menu) => menu.label === 'View',
    )
    const roles = Array.isArray(view?.submenu)
      ? view.submenu.map((item) => item.role)
      : []
    expect(roles).toEqual(
      expect.arrayContaining([
        'reload',
        'toggleDevTools',
        'zoomIn',
        'togglefullscreen',
      ]),
    )
  })

  it('does not bind CmdOrCtrl+B twice', () => {
    const accelerators = menuTemplate(vi.fn(), vi.fn()).flatMap((menu) =>
      Array.isArray(menu.submenu)
        ? menu.submenu.map((item) => item.accelerator)
        : [],
    )
    expect(accelerators.filter((a) => a === 'CmdOrCtrl+B')).toHaveLength(1)
  })
})
