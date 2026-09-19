export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'spork-theme'

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch { return null }
}

export function getSystemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }
  catch { return 'light' }
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

  // Update the theme-color meta for the mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const colors: Record<Theme, string> = { light: '#f5f5f4', dark: '#151515' }
    meta.setAttribute('content', colors[theme])
  }
}

export function persistTheme(theme: Theme): void {
  try { localStorage.setItem(STORAGE_KEY, theme) }
  catch { /* storage unavailable — theme just won’t persist */ }
}
