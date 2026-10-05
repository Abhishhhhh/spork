import { useEffect, useRef } from 'react'

const ITEM = 40 // px — must match .wheel-item height

/**
 * iOS-style scroll wheel. Scrolls with snap; settles on the centred row.
 * Arrow keys step through values; tapping a row selects it.
 */
export function WheelPicker<T extends number | string>({ label, values, value, onChange, format = String }: {
  label: string
  values: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const index = Math.max(0, values.indexOf(value))

  // Keep the scroll position in sync when the value changes from outside (e.g. units switch).
  useEffect(() => {
    const el = listRef.current
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM
  }, [index])

  function handleScroll() {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = listRef.current
      if (!el) return
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)))
      if (values[i] !== value) onChange(values[i])
    }, 90)
  }

  function select(i: number) {
    listRef.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' })
    onChange(values[i])
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && index < values.length - 1) { e.preventDefault(); select(index + 1) }
    if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); select(index - 1) }
  }

  return (
    <div className="flex-1">
      <div className="wheel-label">{label}</div>
      <div className="wheel">
        <div className="wheel-band" aria-hidden="true" />
        <div ref={listRef} className="wheel-list" onScroll={handleScroll} onKeyDown={handleKey}
          tabIndex={0} role="spinbutton" aria-label={label} aria-valuetext={format(value)}>
          <div style={{ height: ITEM * 2 }} />
          {values.map((v, i) => (
            <div key={String(v)} className={`wheel-item ${i === index ? 'on' : ''}`} onClick={() => select(i)}>{format(v)}</div>
          ))}
          <div style={{ height: ITEM * 2 }} />
        </div>
      </div>
    </div>
  )
}
