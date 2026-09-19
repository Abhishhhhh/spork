import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'

interface ShareCardProps {
  photoUrl: string | null
  username: string
  calories: number | null
  proteinG: number | null
  streak: number
  mealName: string | null
  onClose: () => void
}

// ── The card that gets screen-captured ───────────────────────────────────────
// All inline styles — html2canvas ignores Tailwind classes.
// Dark Spork share card: photo on top, Fredoka meal name, three stats.
export const SHARE_CARD_W = 390
export const SHARE_CARD_H = 480

function ShareCardCanvas({
  cardRef, photoUrl, username, calories, proteinG, streak, mealName,
}: Omit<ShareCardProps, 'onClose'> & { cardRef: React.RefObject<HTMLDivElement> }) {
  const stat = (label: string, value: string) => (
    <div>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, letterSpacing: '1.3px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#fff', fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 500, fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
  return (
    <div
      ref={cardRef}
      style={{
        width: SHARE_CARD_W, height: SHARE_CARD_H, boxSizing: 'border-box',
        position: 'relative', borderRadius: 27, overflow: 'hidden', padding: 12,
        backgroundColor: '#1b1b1b', color: '#fff',
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Photo */}
      <div style={{ width: '100%', height: 300, borderRadius: 22, overflow: 'hidden', background: '#313131', position: 'relative' }}>
        {photoUrl
          ? <img src={photoUrl} crossOrigin="anonymous" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'Fredoka, sans-serif', fontSize: 90, color: '#f4f4f3' }}>✳</div>
        }
      </div>

      {/* Text block */}
      <div style={{ padding: '16px 8px 0' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 600, letterSpacing: '1.3px', textTransform: 'uppercase' }}>@{username} on Spork</div>
        <div style={{ fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 500, fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.028em', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {mealName || 'A meal on Spork'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
          {calories != null && stat('Calories', `${Number(calories).toLocaleString()} kcal`)}
          {proteinG != null && stat('Protein', `${proteinG}g`)}
          {streak > 0 && stat('Streak', `${streak} day${streak === 1 ? '' : 's'}`)}
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function ShareModal({ photoUrl, username, calories, proteinG, streak, mealName, onClose }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null!)
  const [ready,  setReady]  = useState(false)
  const [error,  setError]  = useState(false)
  const [canShare, setCanShare]     = useState(false)
  const [blobUrl, setBlobUrl]       = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)

  // Auto-capture as soon as the modal mounts (after a short paint delay)
  const capture = useCallback(async () => {
    // Wait for the card to paint before capturing
    await new Promise((r) => setTimeout(r, 120))
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true, allowTaint: false, scale: 2, backgroundColor: null, logging: false,
      })
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/png', 1))
      if (!blob) { setError(true); return }
      setBlobUrl(URL.createObjectURL(blob))
      setCapturedBlob(blob)
      try {
        const f = new File([blob], 'spork.png', { type: 'image/png' })
        setCanShare(typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [f] })))
      } catch { setCanShare(false) }
      setReady(true)
    } catch (e) {
      console.error('Share capture failed', e)
      setError(true)
    }
  }, [])

  useEffect(() => { capture() }, [capture])

  async function handleShare() {
    if (!capturedBlob) return
    try {
      await navigator.share({
        title: `${username} on Spork`,
        text: `Check out my meal 🍴`,
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
  const scale    = previewW / SHARE_CARD_W

  // Portal to <body> so an animated (transformed) ancestor can't trap the fixed overlay
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div className="w-full max-w-[430px] rounded-t-[36px] bg-canvas px-5 pb-8 pt-4 animate-slide-up">
        <div className="topbar" style={{ marginBottom: 14 }}>
          <span style={{ width: 42 }} />
          <span className="clay">Share</span>
          <button type="button" onClick={onClose} className="circle" aria-label="Close">✕</button>
        </div>

        {/* Card preview — scaled copy of the capture card */}
        <div className="mx-auto overflow-hidden rounded-[22px]" style={{ width: previewW, height: SHARE_CARD_H * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SHARE_CARD_W, height: SHARE_CARD_H }}>
            <ShareCardCanvas
              cardRef={cardRef}
              photoUrl={photoUrl} username={username}
              calories={calories} proteinG={proteinG}
              streak={streak} mealName={mealName}
            />
          </div>
        </div>

        <p className="small muted text-center" style={{ margin: '18px 0' }}>
          Share your meal · tag <b>@sporkapp</b>
        </p>

        {/* Preparing */}
        {!ready && !error && (
          <p className="small muted text-center" style={{ padding: 8 }}>Preparing…</p>
        )}

        {/* Share actions */}
        {ready && (
          <div className="action-row">
            {canShare && (
              <button type="button" onClick={handleShare} className="pill" style={{ padding: 12 }}>Share</button>
            )}
            <button type="button" onClick={handleDownload} className="pill" style={{ padding: 12 }}>Download</button>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer"
              onClick={handleDownload} className="pill no-press" style={{ padding: 12 }}>
              Instagram
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center">
            <p className="error-text">Couldn’t prepare the image</p>
            <button type="button" onClick={() => { setError(false); capture() }} className="pill" style={{ marginTop: 8 }}>
              Try again
            </button>
          </div>
        )}

        <button type="button" onClick={onClose} className="btn">Done</button>
      </div>
    </div>,
    document.body,
  )
}
