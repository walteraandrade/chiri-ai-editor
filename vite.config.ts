import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { buildOpenRouterProxyTable } from './config/openrouter-proxy.ts'

export default defineConfig(({ mode }) => {
  const apiKey = (
    loadEnv(mode, process.cwd(), '').OPENROUTER_API_KEY ?? ''
  ).trim()
  const proxy = buildOpenRouterProxyTable(apiKey)

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __HAS_OPENROUTER_KEY__: JSON.stringify(Boolean(apiKey)),
    },
    build: { chunkSizeWarningLimit: 900 },
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'config/**/*.test.ts'],
    },
  }
})
