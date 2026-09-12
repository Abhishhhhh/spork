import { useState, useEffect, useCallback } from 'react'
import { type Theme, getResolvedTheme, applyTheme, persistTheme, getStoredTheme } from '../lib/theme'

/**
 * Read/write the app theme.
 * The DOM (.dark / .pink class on <html>) is the source of truth — the hook
 * just provides a React interface to it so the settings toggle can be a
 * controlled component.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getResolvedTheme)

  // Apply to DOM whenever state changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Track OS preference changes — only honoured when the user hasn't
  // manually chosen a theme.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setThemeState(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    persistTheme(next)
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
