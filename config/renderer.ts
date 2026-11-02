import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type UserConfig } from 'vite'
import { buildOpenRouterProxyTable } from './openrouter-proxy.ts'
import { devServerOptions } from './ports.ts'

export const rendererConfig = (
  mode: string,
): Required<Pick<UserConfig, 'plugins' | 'define' | 'server' | 'preview'>> => {
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
    server: { ...devServerOptions(env), proxy },
    preview: { proxy },
  }
}
