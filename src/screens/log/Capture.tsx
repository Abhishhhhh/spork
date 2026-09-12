import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogDraftStore } from '../../store/logDraft'
import { useTodayStats } from '../../hooks/useTodayStats'
import DailyProgress from './DailyProgress'

interface CaptureProps {
  onGetEstimate: () => void
  onSkipPhoto: () => void
  onRepeat?: () => void
  recentMealName?: string
}

export default function Capture({ onGetEstimate, onSkipPhoto, onRepeat, recentMealName }: CaptureProps) {
  const navigate = useNavigate()
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
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-5 px-5 py-6">

      <header className="flex items-center gap-4">
        <button onClick={() => navigate('/home/feed')} aria-label="Back"
          className="h-10 w-10 rounded-full border border-border/60 text-primary flex-shrink-0">
          ←
        </button>
        <div>
          <h1 className="text-xl font-semibold text-primary">Log a meal</h1>
          <p className="text-xs text-muted">Photo or manual entry. Always editable.</p>
        </div>
      </header>

      {stats && <DailyProgress stats={stats} />}
      {isError && (
        <button onClick={() => refetch()} className="text-left text-sm text-muted border-0">
          Today's progress couldn't load. Tap to retry.
        </button>
      )}

      {/* ── Photo area ──────────────────────────────────────────── */}
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-surface">
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Meal preview" className="h-full w-full object-cover" />
            {/* Change overlay */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white border-0"
              >
                📷 Retake
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white border-0"
              >
                🖼 Change
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-primary">Add a meal photo</p>
            {/* Two clear options */}
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 px-5 py-3 text-xs font-semibold text-primary"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Camera
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 px-5 py-3 text-xs font-semibold text-primary"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Gallery
              </button>
            </div>
            <p className="text-xs text-muted">or skip below and enter manually</p>
          </div>
        )}
      </div>

      {/* Hidden inputs — camera forces live capture, gallery opens picker */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* ── Optional description ────────────────────────────────── */}
      <details className="rounded-2xl border border-border/60 p-4">
        <summary className="cursor-pointer text-sm text-primary">Add ingredients or quantities (optional)</summary>
        <label className="mt-3 block text-xs text-muted">Help the estimate
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="e.g. 200g chicken, 1 cup rice"
            className="mt-2 w-full rounded-xl border border-border/60 bg-surface px-3 py-3 text-sm text-primary placeholder:text-muted"
          />
        </label>
      </details>

      <p className="text-xs text-muted">
        Photos and ingredient notes are sent for AI estimation. You choose meal visibility before saving.
      </p>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="mt-auto flex flex-col gap-3 pb-3">
        <button
          disabled={!photoFile}
          onClick={onGetEstimate}
          className="rounded-full bg-primary py-3.5 font-semibold text-background disabled:opacity-40"
        >
          Estimate nutrition
        </button>
        <button
          onClick={onSkipPhoto}
          className="rounded-full border border-border/60 py-3 text-sm font-semibold text-primary"
        >
          Enter manually
        </button>
        {onRepeat && (
          <button onClick={onRepeat} className="rounded-2xl border border-border/60 p-3 text-left text-sm text-primary">
            Repeat recent meal
            <span className="mt-1 block text-xs text-muted">{recentMealName || 'Recent meal'} · review before saving</span>
          </button>
        )}
      </div>
    </div>
  )
}
