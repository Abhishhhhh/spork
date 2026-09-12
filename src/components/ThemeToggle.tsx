/**
 * ThemeToggle — 3-way selector: Light · Dark · Pink
 * Self-contained: reads and writes theme directly.
 */
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../lib/theme'

const OPTIONS: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: '☀️', label: 'Light' },
  { value: 'dark',  icon: '🌙', label: 'Dark'  },
  { value: 'pink',  icon: '🌸', label: 'Pink'  },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${
            theme === opt.value
              ? 'bg-primary text-background'
              : 'border border-border/60 text-muted'
          }`}
        >
          <span>{opt.icon}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
