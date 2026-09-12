import { useRef, useState, useEffect, useCallback } from 'react'
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
function ShareCardCanvas({
  cardRef, photoUrl, username, calories, proteinG, streak, mealName,
}: Omit<ShareCardProps, 'onClose'> & { cardRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={cardRef}
      style={{
        width: 390, height: 390,
        position: 'relative', borderRadius: 24, overflow: 'hidden',
        backgroundColor: '#111',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Background */}
      {photoUrl
        ? <img src={photoUrl} crossOrigin="anonymous" alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg,#1a1a1a 0%,#2d1a2e 50%,#1a1a1a 100%)' }} />
      }

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom,rgba(0,0,0,0.6) 0%,transparent 30%,transparent 55%,rgba(0,0,0,0.82) 100%)' }} />

      {/* TOP-LEFT: 🍴 Spork */}
      <div style={{ position: 'absolute', top: 18, left: 20 }}>
        <span style={{ color:'#fff', fontWeight:700, fontSize:15, opacity:0.9,
          textShadow:'0 1px 4px rgba(0,0,0,0.6)', letterSpacing:'-0.01em' }}>
          🍴 Spork
        </span>
      </div>

      {/* TOP-RIGHT: @username */}
      <div style={{ position: 'absolute', top: 18, right: 20 }}>
        <span style={{ color:'#fff', fontWeight:700, fontSize:15,
          textShadow:'0 1px 4px rgba(0,0,0,0.7)', letterSpacing:'-0.01em' }}>
          @{username}
        </span>
      </div>

      {/* Meal name above stats */}
      {mealName && (
        <div style={{ position:'absolute', bottom:62, left:20, right:20, textAlign:'center' }}>
          <span style={{ color:'rgba(255,255,255,0.85)', fontSize:14, fontWeight:500,
            textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>
            {mealName}
          </span>
        </div>
      )}

      {/* BOTTOM: stats */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0,
        padding:'12px 28px 18px', display:'flex', justifyContent:'space-around', alignItems:'flex-end' }}>
        {calories != null && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:2 }}>Calories</div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:22, lineHeight:1,
              textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>{Number(calories).toLocaleString()}</div>
          </div>
        )}
        {proteinG != null && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:2 }}>Protein</div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:22, lineHeight:1,
              textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>{proteinG}g</div>
          </div>
        )}
        {streak > 0 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:2 }}>Streak</div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:22, lineHeight:1,
              textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>🔥 {streak}</div>
          </div>
        )}
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

  return (
    // Full-screen backdrop — flex column, justify-end so sheet sticks to bottom
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 animate-fade-in"
      style={{ alignItems: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div className="w-full max-w-[430px] bg-background rounded-t-3xl pt-5 px-5 pb-24 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold text-primary">Share</span>
          <button onClick={onClose} className="text-sm font-semibold text-muted">Cancel</button>
        </div>

        {/* Card preview — fixed container, scaled card inside */}
        <div className="mx-auto mb-4 overflow-hidden rounded-2xl" style={{ width: 320, height: 320 }}>
          <div style={{ transform: 'scale(0.821)', transformOrigin: 'top left', width: 390, height: 390 }}>
            <ShareCardCanvas
              cardRef={cardRef}
              photoUrl={photoUrl} username={username}
              calories={calories} proteinG={proteinG}
              streak={streak} mealName={mealName}
            />
          </div>
        </div>

        {/* Tag line */}
        <p className="mb-5 text-center text-sm text-muted">
          Share your meal — tag <span className="font-semibold text-primary">@sporkapp</span>
        </p>

        {/* ── States ─────────────────────────────────────────────── */}

        {/* Preparing */}
        {!ready && !error && (
          <div className="flex items-center justify-center gap-2 py-2 text-muted">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span className="text-sm">Preparing…</span>
          </div>
        )}

        {/* Share buttons */}
        {ready && (
          <div className="flex gap-3">
            {canShare && (
              <button onClick={handleShare}
                className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/60 py-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span className="text-xs font-semibold text-primary">Share</span>
              </button>
            )}
            <button onClick={handleDownload}
              className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/60 py-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span className="text-xs font-semibold text-primary">Download</span>
            </button>
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer"
              onClick={handleDownload}
              className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-border/60 py-4 no-press">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round"
                strokeLinejoin="round" className="h-6 w-6" stroke="url(#ig-grad)">
                <defs>
                  <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#F58529"/>
                    <stop offset="50%"  stopColor="#DD2A7B"/>
                    <stop offset="100%" stopColor="#515BD4"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4.5"/>
                <circle cx="17.5" cy="6.5" r="0.5" fill="#DD2A7B" stroke="none"/>
              </svg>
              <span className="text-xs font-semibold text-muted">Instagram</span>
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-error">Couldn't prepare the image.</p>
            <button onClick={() => { setError(false); capture() }}
              className="rounded-full border border-border/60 px-5 py-2 text-sm font-semibold text-primary">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
