import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface ShareCardProps {
  photoUrl: string | null
  username: string
  calories: number | null
  proteinG: number | null
  streak: number
  mealName: string | null
  onClose: () => void
}

// ── Card geometry (CSS px; rendered at 2× for a crisp PNG) ───────────────────
export const SHARE_CARD_W = 390
export const SHARE_CARD_H = 480
const PAD = 12
const PHOTO_H = 300
const RADIUS = 27
const INNER_RADIUS = 22
const CAPTURE_TIMEOUT_MS = 12_000

const DISPLAY = '"Fredoka", system-ui, sans-serif'
const SANS    = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

/**
 * Draws the share card straight onto a canvas — no DOM cloning, so it works
 * the same on iOS Safari as on desktop, and can't hang on fonts or layout.
 */
async function renderShareCard(p: Omit<ShareCardProps, 'onClose'>): Promise<Blob> {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_CARD_W * scale
  canvas.height = SHARE_CARD_H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.scale(scale, scale)

  // Make sure the web fonts are usable on the canvas (best effort)
  try { await Promise.race([document.fonts.load(`500 28px ${DISPLAY}`), new Promise((r) => setTimeout(r, 1500))]) } catch { /* fall back to system font */ }
  try { await Promise.race([document.fonts.load(`600 10px ${SANS}`), new Promise((r) => setTimeout(r, 800))]) } catch { /* fall back */ }

  // Card background
  roundRect(ctx, 0, 0, SHARE_CARD_W, SHARE_CARD_H, RADIUS)
  ctx.fillStyle = '#1b1b1b'
  ctx.fill()

  // Photo (or placeholder)
  const photoW = SHARE_CARD_W - PAD * 2
  ctx.save()
  roundRect(ctx, PAD, PAD, photoW, PHOTO_H, INNER_RADIUS)
  ctx.clip()
  ctx.fillStyle = '#313131'
  ctx.fillRect(PAD, PAD, photoW, PHOTO_H)
  const img = p.photoUrl ? await loadImage(p.photoUrl) : null
  if (img) {
    // object-fit: cover
    const s = Math.max(photoW / img.naturalWidth, PHOTO_H / img.naturalHeight)
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s
    ctx.drawImage(img, PAD + (photoW - dw) / 2, PAD + (PHOTO_H - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = '#f4f4f3'
    ctx.font = `500 90px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✳', SHARE_CARD_W / 2, PAD + PHOTO_H / 2)
  }
  ctx.restore()

  // Text block
  const x = PAD + 8
  let y = PAD + PHOTO_H + 16
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = `600 10px ${SANS}`
  ctx.letterSpacing = '1.3px'
  ctx.fillText(`@${p.username} ON SPORK`.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
  y += 18

  ctx.fillStyle = '#ffffff'
  ctx.font = `500 28px ${DISPLAY}`
  ctx.fillText(ellipsize(ctx, p.mealName || 'A meal on Spork', SHARE_CARD_W - x * 2), x, y)
  y += 46

  const stats: [string, string][] = []
  if (p.calories != null) stats.push(['CALORIES', `${Number(p.calories).toLocaleString()} kcal`])
  if (p.proteinG != null) stats.push(['PROTEIN', `${p.proteinG}g`])
  if (p.streak > 0) stats.push(['STREAK', `${p.streak} day${p.streak === 1 ? '' : 's'}`])
  const colW = (SHARE_CARD_W - x * 2) / Math.max(stats.length, 1)
  stats.forEach(([label, value], i) => {
    const cx = x + i * colW
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `600 10px ${SANS}`
    ctx.letterSpacing = '1.3px'
    ctx.fillText(label, cx, y)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = '#ffffff'
    ctx.font = `500 22px ${DISPLAY}`
    ctx.fillText(value, cx, y + 16)
  })

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png', 1)
    } catch (e) {
      // A tainted canvas (photo served without CORS) throws here
      reject(e instanceof Error ? e : new Error('Could not encode image'))
    }
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function ShareModal({ photoUrl, username, calories, proteinG, streak, mealName, onClose }: ShareCardProps) {
  const [ready,  setReady]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [canShare, setCanShare]     = useState(false)
  const [blobUrl, setBlobUrl]       = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const capture = useCallback(async () => {
    setReady(false)
    setError(null)
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out preparing the image')), CAPTURE_TIMEOUT_MS),
      )
      const blob = await Promise.race([renderShareCard({ photoUrl, username, calories, proteinG, streak, mealName }), timeout])
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setBlobUrl(url)
      setCapturedBlob(blob)
      try {
        const f = new File([blob], 'spork.png', { type: 'image/png' })
        setCanShare(typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [f] })))
      } catch { setCanShare(false) }
      setReady(true)
    } catch (e) {
      console.error('Share capture failed', e)
      setError(e instanceof Error ? e.message : 'Couldn’t prepare the image')
    }
  }, [photoUrl, username, calories, proteinG, streak, mealName])

  useEffect(() => { capture() }, [capture])
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  async function handleShare() {
    if (!capturedBlob) return
    try {
      await navigator.share({
        title: `${username} on Spork`,
        text: 'Check out my meal 🍴',
        files: [new File([capturedBlob], `spork-${username}.png`, { type: 'image/png' })],
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `spork-${username}-meal.png`
    a.click()
  }

  const previewW = 300
  const previewH = Math.round(previewW * (SHARE_CARD_H / SHARE_CARD_W))

  // Portal to <body> so an animated (transformed) ancestor can't trap the fixed overlay
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[430px] rounded-t-[36px] bg-canvas px-5 pb-8 pt-4 animate-slide-up">
        <div className="topbar" style={{ marginBottom: 14 }}>
          <span style={{ width: 42 }} />
          <span className="clay">Share</span>
          <button type="button" onClick={onClose} className="circle" aria-label="Close">✕</button>
        </div>

        {/* Preview is the actual PNG we'll share — what you see is what you get */}
        <div className="mx-auto overflow-hidden rounded-[22px] bg-inverse" style={{ width: previewW, height: previewH }}>
          {blobUrl
            ? <img src={blobUrl} alt="Share card preview" style={{ width: previewW, height: previewH, display: 'block' }} />
            : <div className="skeleton h-full w-full !rounded-none" />}
        </div>

        <p className="small muted text-center" style={{ margin: '18px 0' }}>
          Share your meal · tag <b>@sporkapp</b>
        </p>

        {!ready && !error && <p className="small muted text-center" style={{ padding: 8 }}>Preparing…</p>}

        {ready && (
          <div className="action-row">
            {canShare && <button type="button" onClick={handleShare} className="pill" style={{ padding: 12 }}>Share</button>}
            <button type="button" onClick={handleDownload} className="pill" style={{ padding: 12 }}>Download</button>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" onClick={handleDownload} className="pill no-press" style={{ padding: 12 }}>
              Instagram
            </a>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="error-text">{error}</p>
            <button type="button" onClick={capture} className="pill" style={{ marginTop: 8 }}>Try again</button>
          </div>
        )}

        <button type="button" onClick={onClose} className="btn">Done</button>
      </div>
    </div>,
    document.body,
  )
}
