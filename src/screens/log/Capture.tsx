import { useEffect, useMemo, useRef } from 'react'
import { useLogDraftStore } from '../../store/logDraft'
import { useTodayStats } from '../../hooks/useTodayStats'
import { TopBar } from '../../components/TopBar'
import DailyProgress from './DailyProgress'

interface CaptureProps {
  onGetEstimate: () => void
  onSkipPhoto: () => void
  onRepeat?: () => void
  recentMealName?: string
}

export default function Capture({ onGetEstimate, onSkipPhoto, onRepeat, recentMealName }: CaptureProps) {
  const { photoFile, description, setPhoto, setDescription } = useLogDraftStore()
  const { data: stats, isError, refetch } = useTodayStats()

  // Two separate file inputs: one forces camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const previewUrl = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setPhoto(file)
    // Reset so the same file can be re-selected if needed
    event.target.value = ''
  }

  return (
    <div>
      <TopBar title="Log a meal" back="/home/feed" />
      <p className="muted small">Photo or manual entry · Always editable</p>

      {stats && <DailyProgress stats={stats} />}
      {isError && (
        <button type="button" onClick={() => refetch()} className="small muted block" style={{ margin: '12px 0' }}>
          Today’s progress couldn’t load · Tap to retry
        </button>
      )}

      {/* ── Photo area ──────────────────────────────────────────── */}
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} alt="Meal preview" className="photo natural" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            <button type="button" onClick={() => cameraInputRef.current?.click()} className="pill photo-pill">Retake</button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="pill photo-pill">Change</button>
          </div>
        </div>
      ) : (
        <div className="photo-placeholder">
          <span className="icon">▣</span>
          <h3>Add a meal photo</h3>
          <div className="action-row w-full max-w-[220px]">
            <button type="button" onClick={() => cameraInputRef.current?.click()} className="pill">Camera</button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="pill">Gallery</button>
          </div>
          <p className="small muted">or enter manually below</p>
        </div>
      )}

      {/* Hidden inputs — camera forces live capture, gallery opens picker */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

      {/* ── Optional description ────────────────────────────────── */}
      <label className="card block">
        <p>Add ingredients or quantities · optional</p>
        <p className="small muted">Help the estimate with more detail</p>
        <input
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="e.g. 200g chicken, 1 cup rice"
          className="input bg-soft"
          style={{ marginTop: 12 }}
        />
      </label>

      <p className="tiny muted">
        Photos and ingredient notes are sent for AI estimation · You choose visibility before saving
      </p>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <button type="button" disabled={!photoFile} onClick={onGetEstimate} className="btn">
        Estimate nutrition
      </button>
      <button type="button" onClick={onSkipPhoto} className="btn light">
        Enter manually
      </button>
      {onRepeat && (
        <button type="button" onClick={onRepeat} className="card block w-full text-left">
          Repeat recent meal
          <span className="small muted block" style={{ marginTop: 4 }}>{recentMealName || 'Recent meal'} · review before saving</span>
        </button>
      )}
    </div>
  )
}
