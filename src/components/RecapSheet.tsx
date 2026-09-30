import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WeeklyRecap } from '../lib/weeklyRecap'

// Card geometry (CSS px; rendered at 2× for a crisp PNG). Same look as the meal share card.
const W = 390
const H = 500
const PAD = 22
const DISPLAY = '"Fredoka", system-ui, sans-serif'
const SANS    = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const INK = '#ffffff'
const MUTED = 'rgba(255,255,255,0.6)'
const TILE = '#262626'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function caps(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.fillStyle = MUTED
  ctx.font = `600 10px ${SANS}`
  ctx.letterSpacing = '1.3px'
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')

async function renderRecapCard(recap: WeeklyRecap, username: string): Promise<Blob> {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.scale(scale, scale)
  try { await Promise.race([document.fonts.load(`500 30px ${DISPLAY}`), new Promise((r) => setTimeout(r, 1500))]) } catch { /* system font */ }
  try { await Promise.race([document.fonts.load(`600 10px ${SANS}`), new Promise((r) => setTimeout(r, 800))]) } catch { /* system font */ }

  roundRect(ctx, 0, 0, W, H, 27)
  ctx.fillStyle = '#1b1b1b'
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // Header
  let y = PAD + 4
  caps(ctx, `@${username} · week in review`, PAD, y)
  y += 20
  ctx.fillStyle = INK
  ctx.font = `500 32px ${DISPLAY}`
  ctx.fillText(recap.label, PAD, y)
  y += 58

  // Mon–Sun dots
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const step = (W - PAD * 2) / 7
  recap.days.forEach((logged, i) => {
    const cx = PAD + step * i + step / 2
    ctx.beginPath()
    ctx.arc(cx, y + 13, 13, 0, Math.PI * 2)
    if (logged) { ctx.fillStyle = INK; ctx.fill() } else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke() }
    ctx.fillStyle = MUTED
    ctx.font = `600 10px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText(letters[i], cx, y + 33)
    ctx.textAlign = 'left'
  })
  y += 62

  // 2 × 2 stat tiles
  const gap = 10
  const tileW = (W - PAD * 2 - gap) / 2
  const tileH = 92
  const tiles: [string, string, string][] = [
    ['Days logged', `${recap.daysLogged}/7`, recap.daysLogged === 7 ? 'Perfect week' : `${recap.meals} meal${recap.meals === 1 ? '' : 's'}`],
    ['Avg calories', recap.avgCalories != null ? fmt(recap.avgCalories) : '—', recap.calorieGoal ? `goal ${fmt(recap.calorieGoal)}` : 'kcal per day'],
    ['Protein goal', recap.proteinDays != null ? `${recap.proteinDays}/7` : '—', recap.proteinGoal ? `days ≥ ${recap.proteinGoal} g` : 'no goal set'],
    ['Meals logged', String(recap.meals), recap.daysLogged ? `${(recap.meals / recap.daysLogged).toFixed(1)} per day` : ''],
  ]
  tiles.forEach(([label, value, sub], i) => {
    const x = PAD + (i % 2) * (tileW + gap)
    const ty = y + Math.floor(i / 2) * (tileH + gap)
    roundRect(ctx, x, ty, tileW, tileH, 18)
    ctx.fillStyle = TILE
    ctx.fill()
    caps(ctx, label, x + 14, ty + 14)
    ctx.fillStyle = INK
    ctx.font = `500 28px ${DISPLAY}`
    ctx.fillText(value, x + 14, ty + 32)
    ctx.fillStyle = MUTED
    ctx.font = `500 11px ${SANS}`
    ctx.fillText(sub, x + 14, ty + 68)
  })
  y += tileH * 2 + gap + 22

  // Extras
  ctx.font = `500 13px ${SANS}`
  if (recap.calorieChange != null && recap.calorieChange !== 0) {
    const down = recap.calorieChange < 0
    ctx.fillStyle = INK
    ctx.fillText(`${down ? '↓' : '↑'} ${fmt(Math.abs(recap.calorieChange))} kcal/day vs the week before`, PAD, y)
    y += 24
  }
  if (recap.topMeal) {
    ctx.fillStyle = INK
    const text = `♥ Most-liked: ${recap.topMeal.name} · ${recap.topMeal.likes} like${recap.topMeal.likes === 1 ? '' : 's'}`
    ctx.fillText(ellipsize(ctx, text, W - PAD * 2), PAD, y)
  }

  // Footer: orb + spork.fit
  const fy = H - PAD - 18
  const k = 18 / 100
  ctx.strokeStyle = INK
  ctx.lineCap = 'round'
  ctx.lineWidth = 12 * k
  ctx.beginPath(); ctx.arc(PAD + 9, fy + 9, 38 * k, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = 9 * k
  for (const x of [37, 50, 63]) {
    ctx.beginPath(); ctx.moveTo(PAD + x * k, fy + 38 * k); ctx.lineTo(PAD + x * k, fy + 60 * k); ctx.stroke()
  }
  ctx.fillStyle = MUTED
  ctx.font = `600 12px ${SANS}`
  ctx.fillText('spork.fit', PAD + 26, fy + 3)

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png', 1))
}

export function RecapSheet({ recap, username, onClose }: { recap: WeeklyRecap; username: string; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const urlRef = useRef<string | null>(null)

  const draw = useCallback(async () => {
    setError(false)
    try {
      const b = await renderRecapCard(recap, username)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(b)
      setBlob(b)
      setUrl(urlRef.current)
      try {
        setCanShare(typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [new File([b], 'recap.png', { type: 'image/png' })] })))
      } catch { setCanShare(false) }
    } catch {
      setError(true)
    }
  }, [recap, username])

  useEffect(() => { draw() }, [draw])
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  async function share() {
    if (!blob) return
    try {
      await navigator.share({ text: `My week on Spork 🍴 https://www.spork.fit`, files: [new File([blob], `spork-week-${recap.label}.png`, { type: 'image/png' })] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  function download() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `spork-week-${recap.label}.png`
    a.click()
  }

  const previewW = 300
  // Portal to <body> so an animated (transformed) ancestor can't trap the fixed overlay
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[430px] rounded-t-[36px] bg-canvas px-5 pb-8 pt-4 animate-slide-up" role="dialog" aria-label="Weekly recap">
        <div className="topbar" style={{ marginBottom: 14 }}>
          <span style={{ width: 42 }} />
          <span className="clay">Your week</span>
          <button type="button" onClick={onClose} className="circle" aria-label="Close">✕</button>
        </div>

        <div className="mx-auto overflow-hidden rounded-[22px] bg-inverse" style={{ width: previewW, height: Math.round(previewW * H / W) }}>
          {url
            ? <img src={url} alt={`Week of ${recap.label}: ${recap.daysLogged} of 7 days logged, ${recap.meals} meals`} style={{ width: '100%', height: '100%', display: 'block' }} />
            : <div className="skeleton h-full w-full !rounded-none" />}
        </div>

        {error && (
          <div className="text-center" style={{ marginTop: 12 }}>
            <p className="error-text">Couldn’t draw your recap.</p>
            <button type="button" onClick={draw} className="pill" style={{ marginTop: 8 }}>Try again</button>
          </div>
        )}

        {url && (
          <div className="action-row" style={{ marginTop: 18 }}>
            {canShare && <button type="button" onClick={share} className="pill" style={{ padding: 12 }}>Share</button>}
            <button type="button" onClick={download} className="pill" style={{ padding: 12 }}>Download</button>
          </div>
        )}

        <button type="button" onClick={onClose} className="btn">Done</button>
      </div>
    </div>,
    document.body,
  )
}
