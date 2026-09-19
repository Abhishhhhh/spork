export type Theme = 'light' | 'dark' | 'pink'

const STORAGE_KEY = 'spork-theme'

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'pink' ? v : null
  } catch { return null }
}

export function getSystemTheme(): Theme {
  // Default to dark — Spork's primary theme
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark' }
  catch { return 'dark' }
}

/** The theme that should actually be applied right now. */
export function getResolvedTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

/** Applies the theme by toggling class on <html>. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.remove('dark', 'pink')
  if (theme === 'dark') root.classList.add('dark')
  if (theme === 'pink') root.classList.add('pink')

  // Update the theme-color meta for the mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const colors: Record<Theme, string> = {
      light: '#f5f5f4',
      dark:  '#000000',
      pink:  '#FFF0F5',
    }
    meta.setAttribute('content', colors[theme])
  }
}

export function persistTheme(theme: Theme): void {
  try { localStorage.setItem(STORAGE_KEY, theme) }
  catch { /* storage unavailable — theme just won't persist */ }
}
