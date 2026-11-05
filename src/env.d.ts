declare const __HAS_OPENROUTER_KEY__: boolean
declare const __OPENROUTER_MODEL__: string

interface Window {
  __aiCalls?: import('./ai/records').AiCallRecord[]
  __reviewDrops?: import('./ai/dev-log').ReviewDropEntry[]
  chiri?: import('../electron/api').ChiriApi
}

declare module 'virtual:omarchy-theme' {
  const theme: import('./theme/tokens').ThemeTokens | null
  export default theme
}
