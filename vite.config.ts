import { defineConfig } from 'vitest/config'
import { rendererConfig } from './config/renderer.ts'

export default defineConfig(({ mode }) => ({
  ...rendererConfig(mode),
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.{ts,tsx}',
      'config/**/*.test.ts',
      'electron/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
}))
