/**
 * SVG donut ring showing progress toward a daily calorie goal.
 * Uses CSS custom properties so it automatically adapts to dark mode.
 */
interface CalorieRingProps {
  pct: number        // 0–1
  size?: number      // diameter in px (default 120)
  strokeWidth?: number
  label: string
  sublabel?: string
  over?: boolean
}

export function CalorieRing({
  pct,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  over = false,
}: CalorieRingProps) {
  const r           = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const clamped     = Math.min(Math.max(pct, 0), 1)
  const offset      = circumference * (1 - clamped)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={over ? 'var(--color-error)' : 'var(--color-primary)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      {/* Centre label */}
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        style={{ fontSize: size * 0.18, fontWeight: 700, fill: 'var(--color-primary)' }}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x="50%" y="65%"
          textAnchor="middle"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          style={{ fontSize: size * 0.1, fill: 'var(--color-muted)' }}
        >
          {sublabel}
        </text>
      )}
    </svg>
  )
}
