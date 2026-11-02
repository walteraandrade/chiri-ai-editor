import { useEffect, useRef, useState } from 'react'
import { getLocalStorage } from '../document/storage'
import { applyTheme } from '../theme/apply-theme'
import {
  initialOmarchyTheme,
  onOmarchyThemeChange,
} from '../theme/omarchy-source'
import {
  loadThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
} from '../theme/preference'
import type { ThemeTokens } from '../theme/tokens'

export type ThemeState = {
  readonly omarchy: ThemeTokens | null
  readonly choice: ThemeChoice
  readonly toggle: () => void
}

export const activeTheme = (
  choice: ThemeChoice,
  omarchy: ThemeTokens | null,
): ThemeTokens | null => (choice === 'omarchy' ? omarchy : null)

export const applyInitialTheme = (): void =>
  applyTheme(
    document.documentElement,
    activeTheme(loadThemeChoice(getLocalStorage()), initialOmarchyTheme),
    { animate: false },
  )

export function useTheme(): ThemeState {
  const [omarchy, setOmarchy] = useState(initialOmarchyTheme)
  const [choice, setChoice] = useState(() => loadThemeChoice(getLocalStorage()))
  const applied = useRef(false)

  useEffect(() => onOmarchyThemeChange(setOmarchy), [])

  useEffect(() => {
    applyTheme(document.documentElement, activeTheme(choice, omarchy), {
      animate: applied.current,
    })
    applied.current = true
  }, [choice, omarchy])

  const toggle = (): void => {
    const next = choice === 'omarchy' ? 'chiri' : 'omarchy'
    saveThemeChoice(getLocalStorage(), next)
    setChoice(next)
  }

  return { omarchy, choice, toggle }
}
