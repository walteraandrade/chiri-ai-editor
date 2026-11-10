import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type UserConfig } from 'vite'
import { buildInfo } from './build-info.ts'
import { omarchyTheme } from './omarchy-theme.ts'
import { buildOpenRouterProxyTable } from './openrouter-proxy.ts'
import { devServerOptions } from './ports.ts'

export const rendererConfig = (
  mode: string,
): Required<Pick<UserConfig, 'plugins' | 'define' | 'server' | 'preview'>> => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = (env.OPENROUTER_API_KEY ?? '').trim()
  const model = (env.OPENROUTER_MODEL ?? '').trim()
  const proxy = buildOpenRouterProxyTable(apiKey)
  const { version, commit } = buildInfo()

  return {
    plugins: [react(), tailwindcss(), omarchyTheme()],
    define: {
      __HAS_OPENROUTER_KEY__: JSON.stringify(Boolean(apiKey)),
      __OPENROUTER_MODEL__: JSON.stringify(model),
      __APP_VERSION__: JSON.stringify(version),
      __APP_COMMIT__: JSON.stringify(commit),
    },
    server: { ...devServerOptions(env), proxy },
    preview: { proxy },
  }
}
