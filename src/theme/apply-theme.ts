import { getLocalStorage } from '../document/storage'
import { initialOmarchyTheme } from './omarchy-source'
import { activeTheme, loadThemeChoice } from './preference'
import {
  THEME_VARIABLE_NAMES,
  type ThemeTokens,
  themeVariables,
} from './tokens'

const setVariables = (root: HTMLElement, tokens: ThemeTokens): void => {
  for (const name of THEME_VARIABLE_NAMES) root.style.removeProperty(name)
  for (const [name, value] of Object.entries(themeVariables(tokens)))
    root.style.setProperty(name, value)
  root.dataset.themeMode = tokens.mode
}

export const applyTheme = (
  root: HTMLElement,
  tokens: ThemeTokens,
  { crossfade }: { readonly crossfade: boolean },
): void => {
  const update = () => setVariables(root, tokens)
  if (crossfade && document.startViewTransition)
    document.startViewTransition(update)
  else update()
}

export const applyInitialTheme = (): void =>
  applyTheme(
    document.documentElement,
    activeTheme(loadThemeChoice(getLocalStorage()), initialOmarchyTheme),
    { crossfade: false },
  )
