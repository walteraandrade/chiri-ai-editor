import type { MenuItemConstructorOptions } from 'electron'

export const menuTemplate = (
  onPreferences: () => void,
): MenuItemConstructorOptions[] => [
  {
    label: 'File',
    submenu: [
      {
        label: 'Preferences…',
        accelerator: 'CmdOrCtrl+,',
        click: onPreferences,
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
]
