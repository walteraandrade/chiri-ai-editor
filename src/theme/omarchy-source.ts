import initialTheme from 'virtual:omarchy-theme'
import { OMARCHY_THEME_EVENT } from './omarchy-protocol'
import type { ThemeTokens } from './tokens'

type Listener = (tokens: ThemeTokens | null) => void

export const initialOmarchyTheme: ThemeTokens | null = initialTheme

export const onOmarchyThemeChange = (listener: Listener): (() => void) => {
  const hot = import.meta.hot
  if (!hot) return () => undefined
  hot.on(OMARCHY_THEME_EVENT, listener)
  return () => hot.off(OMARCHY_THEME_EVENT, listener)
}
