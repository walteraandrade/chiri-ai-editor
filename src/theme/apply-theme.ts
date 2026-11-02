import { prefersReducedMotion } from '../ui/motion'
import {
  THEME_VARIABLE_NAMES,
  type ThemeTokens,
  themeVariables,
} from './tokens'

const setVariables = (root: HTMLElement, tokens: ThemeTokens | null): void => {
  for (const name of THEME_VARIABLE_NAMES) root.style.removeProperty(name)
  for (const [name, value] of Object.entries(
    tokens ? themeVariables(tokens) : {},
  ))
    root.style.setProperty(name, value)
  root.dataset.themeMode = tokens?.mode ?? 'dark'
}

export const applyTheme = (
  root: HTMLElement,
  tokens: ThemeTokens | null,
  { animate }: { readonly animate: boolean },
): void => {
  const update = () => setVariables(root, tokens)
  if (animate && !prefersReducedMotion() && document.startViewTransition)
    document.startViewTransition(update)
  else update()
}
