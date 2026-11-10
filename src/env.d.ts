declare const __HAS_OPENROUTER_KEY__: boolean
declare const __OPENROUTER_MODEL__: string
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string

interface Window {
  __aiCalls?: import('./ai/records').AiCallRecord[]
  __reviewDrops?: import('./ai/dev-log').ReviewDropEntry[]
  desafinado?: import('../electron/api').DesafinadoApi
}

declare module 'virtual:omarchy-theme' {
  const theme: import('./theme/tokens').ThemeTokens | null
  export default theme
}
