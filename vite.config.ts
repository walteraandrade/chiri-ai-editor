import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { buildOpenRouterProxyTable } from './config/openrouter-proxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = (env.OPENROUTER_API_KEY ?? '').trim()
  const model = (env.OPENROUTER_MODEL ?? '').trim()
  const proxy = buildOpenRouterProxyTable(apiKey)

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __HAS_OPENROUTER_KEY__: JSON.stringify(Boolean(apiKey)),
      __OPENROUTER_MODEL__: JSON.stringify(model),
    },
    build: { chunkSizeWarningLimit: 900 },
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'node',
      include: [
        'src/**/*.test.{ts,tsx}',
        'config/**/*.test.ts',
        'scripts/**/*.test.ts',
      ],
    },
  }
})
