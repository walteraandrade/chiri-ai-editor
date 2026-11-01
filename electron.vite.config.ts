import { defineConfig } from 'electron-vite'
import { rendererConfig } from './config/renderer.ts'

export default defineConfig(({ mode }) => ({
  main: {
    build: {
      externalizeDeps: false,
      lib: { entry: 'electron/main/index.ts' },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      lib: { entry: 'electron/preload/index.ts' },
      rolldownOptions: {
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: '.',
    ...rendererConfig(mode),
    build: {
      rolldownOptions: { input: 'electron.html' },
    },
  },
}))
