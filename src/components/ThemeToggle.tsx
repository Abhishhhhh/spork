/**
 * ThemeToggle — Light · Dark segmented pill
 * Self-contained: reads and writes theme directly.
 */
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../lib/theme'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark'  },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`pill tint ${theme === opt.value ? 'sel' : ''}`}
          aria-pressed={theme === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
