/** Progress ring. `progress` is 0–1 (clamped); content sits in the middle. */
export function Ring({ progress, color, size = 86, stroke = 8, children }: {
  progress: number
  color: string
  size?: number
  stroke?: number
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div style={{ width: size, height: size, position: 'relative', margin: '10px auto 4px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-soft2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - p)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="font-display" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size > 80 ? 20 : 15 }}>
        {children}
      </div>
    </div>
  )
}
