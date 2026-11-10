import { useEffect, useRef, useState } from 'react'
import { getLocalStorage } from '../document/storage'
import { applyTheme } from '../theme/apply-theme'
import {
  initialOmarchyTheme,
  onOmarchyThemeChange,
} from '../theme/omarchy-source'
import {
  activeTheme,
  loadThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
} from '../theme/preference'
import type { ThemeTokens } from '../theme/tokens'
import { prefersReducedMotion } from './motion'

export type ThemeState = {
  readonly omarchy: ThemeTokens | null
  readonly choice: ThemeChoice
  readonly choose: (choice: ThemeChoice) => void
}

export function useTheme(
  onApplied?: (tokens: ThemeTokens) => void,
): ThemeState {
  const [omarchy, setOmarchy] = useState(initialOmarchyTheme)
  const [choice, setChoice] = useState(() => loadThemeChoice(getLocalStorage()))
  const applied = useRef(false)

  useEffect(() => onOmarchyThemeChange(setOmarchy), [])

  useEffect(() => {
    const tokens = activeTheme(choice, omarchy)
    applyTheme(document.documentElement, tokens, {
      crossfade: applied.current && !prefersReducedMotion(),
    })
    applied.current = true
    onApplied?.(tokens)
  }, [choice, omarchy, onApplied])

  const choose = (next: ThemeChoice): void => {
    saveThemeChoice(getLocalStorage(), next)
    setChoice(next)
  }

  return { omarchy, choice, choose }
}
