import { defineConfig } from 'electron-vite'
import { rendererConfig } from './config/renderer.ts'

export default defineConfig(({ mode }) => ({
  main: {
    build: {
      lib: { entry: 'electron/main/index.ts' },
    },
  },
  preload: {
    build: {
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
