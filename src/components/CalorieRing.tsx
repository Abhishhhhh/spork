/**
 * Conic-style ring showing progress toward a daily calorie goal.
 * Fill uses the teal tracking accent; overrun switches to error red.
 * Matches the Spork UI mockup: 132px ring, 103px paper centre, Fredoka number.
 */
interface CalorieRingProps {
  pct: number        // 0–1
  size?: number      // diameter in px (default 132)
  label: string
  sublabel?: string
  over?: boolean
}

export function CalorieRing({ pct, size = 132, label, sublabel, over = false }: CalorieRingProps) {
  const strokeWidth   = Math.round(size * 0.11)
  const r             = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const clamped       = Math.min(Math.max(pct, 0), 1)
  const offset        = circumference * (1 - clamped)

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={over ? 'var(--color-error)' : 'var(--color-teal)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 m-auto flex flex-col items-center justify-center rounded-full bg-paper"
        style={{ width: size - strokeWidth * 2, height: size - strokeWidth * 2 }}
      >
        <b className="font-display" style={{ fontSize: size * 0.21, lineHeight: 1 }}>{label}</b>
        {sublabel && <small className="muted" style={{ fontSize: 10 }}>{sublabel}</small>}
      </div>
    </div>
  )
}
