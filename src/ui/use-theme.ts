import { useCallback, useEffect, useRef, useState } from 'react'
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
import { currentVariantKey, variantByKey } from '../theme/wada-prototype'
import { prefersReducedMotion } from './motion'

export type ThemeState = {
  readonly omarchy: ThemeTokens | null
  readonly choice: ThemeChoice
  readonly toggle: () => void
  readonly variant: string
  readonly setVariant: (key: string) => void
}

export function useTheme(): ThemeState {
  const [omarchy, setOmarchy] = useState(initialOmarchyTheme)
  const [choice, setChoice] = useState(() => loadThemeChoice(getLocalStorage()))
  const [variant, setVariantState] = useState(currentVariantKey)
  const applied = useRef(false)

  useEffect(() => onOmarchyThemeChange(setOmarchy), [])

  useEffect(() => {
    applyTheme(
      document.documentElement,
      variantByKey(variant)?.theme ?? activeTheme(choice, omarchy),
      { crossfade: applied.current && !prefersReducedMotion() },
    )
    applied.current = true
  }, [choice, omarchy, variant])

  const setVariant = useCallback((key: string): void => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', key)
    window.history.replaceState(null, '', url)
    setVariantState(key)
  }, [])

  const toggle = (): void => {
    const next = choice === 'omarchy' ? 'chiri' : 'omarchy'
    saveThemeChoice(getLocalStorage(), next)
    setChoice(next)
  }

  return { omarchy, choice, toggle, variant, setVariant }
}
