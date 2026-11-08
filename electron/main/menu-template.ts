import type { MenuItemConstructorOptions } from 'electron'

export const menuTemplate = (
  onPreferences: () => void,
  onLibrary: () => void,
  platform: NodeJS.Platform = process.platform,
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
  {
    label: 'View',
    submenu: [
      {
        label: 'Library',
        accelerator: 'CmdOrCtrl+B',
        registerAccelerator: platform === 'darwin',
        click: onLibrary,
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  { role: 'windowMenu' },
]
