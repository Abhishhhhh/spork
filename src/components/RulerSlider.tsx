import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const TICK = 10 // px between minor ticks

/**
 * Horizontal ruler you drag or swipe; the value under the centre line wins.
 * Works with touch, trackpad, mouse drag and arrow keys.
 */
export function RulerSlider({ min, max, step = 0.1, majorEvery = 10, value, onChange, label }: {
  min: number
  max: number
  step?: number
  /** A long tick every N steps (10 × 0.1 kg = every 1 kg). */
  majorEvery?: number
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const [width, setWidth] = useState(0)
  const steps = Math.round((max - min) / step)
  const decimals = (String(step).split('.')[1] ?? '').length
  const toValue = (left: number) => Number(Math.min(max, Math.max(min, min + Math.round(left / TICK) * step)).toFixed(decimals))
  const toLeft = (v: number) => Math.round((v - min) / step) * TICK

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Follow outside changes (and the first layout).
  useEffect(() => {
    const el = trackRef.current
    if (el && width && toValue(el.scrollLeft) !== value) el.scrollLeft = toLeft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width])

  function handleScroll() {
    const el = trackRef.current
    if (!el) return
    const next = toValue(el.scrollLeft)
    if (next !== value) onChange(next)       // live update while scrolling
    clearTimeout(settle.current)
    settle.current = setTimeout(() => { if (!drag.current) el.scrollTo({ left: toLeft(next), behavior: 'smooth' }) }, 120)
  }

  function nudge(by: number) {
    const next = Number(Math.min(max, Math.max(min, value + by)).toFixed(decimals))
    onChange(next)
    trackRef.current?.scrollTo({ left: toLeft(next), behavior: 'smooth' })
  }

  return (
    <div className="ruler">
      <div ref={trackRef} className="ruler-track" onScroll={handleScroll} tabIndex={0}
        role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step) }
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') return
          drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => { if (drag.current) e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x) }}
        onPointerUp={() => { drag.current = null; handleScroll() }}>
        <div style={{ width: steps * TICK + width, height: '100%' }}>
          <div className="ruler-ticks" style={{
            marginLeft: width / 2, width: steps * TICK + 2,
            ['--tick' as string]: `${TICK}px`, ['--major' as string]: `${TICK * majorEvery}px`, ['--offset' as string]: '0px',
          }} />
        </div>
      </div>
      <div className="ruler-mark" aria-hidden="true" />
    </div>
  )
}
