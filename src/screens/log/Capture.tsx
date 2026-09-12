import { useEffect, useMemo } from 'react'
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
  const previewUrl = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  return <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-5 px-5 py-6">
    <header className="flex items-center gap-4">
      <button onClick={() => navigate('/home/feed')} aria-label="Back" className="h-10 w-10 rounded-full border border-border/60">←</button>
      <div><h1 className="text-xl font-semibold text-primary">Log a meal</h1><p className="text-xs text-muted">Photo or manual entry. Always editable.</p></div>
    </header>
    {stats && <DailyProgress stats={stats} />}
    {isError && <button onClick={() => refetch()} className="text-left text-sm text-muted">Today's progress couldn't load. Tap to retry; you can still log.</button>}
    <label className="relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border/60">
      {previewUrl ? <><img src={previewUrl} alt="Meal preview" className="h-full w-full object-cover" /><span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">Change photo</span></> : <div className="text-center"><p className="font-semibold text-primary">Add a meal photo</p><p className="mt-1 text-xs text-muted">Use your camera or choose an image</p></div>}
      <input type="file" accept="image/*" capture="environment" aria-label="Meal photo" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) setPhoto(file) }} />
    </label>
    <details className="rounded-2xl border border-border/60 p-4"><summary className="cursor-pointer text-sm text-primary">Add ingredients or quantities (optional)</summary>
      <label className="mt-3 block text-xs text-muted">Help the estimate
        <input value={description} onChange={event => setDescription(event.target.value)} placeholder="e.g. 200g chicken, 1 cup rice" className="mt-2 w-full rounded-xl border border-border/60 bg-surface px-3 py-3 text-sm text-primary placeholder:text-muted" />
      </label>
    </details>
    <p className="text-xs text-muted">Photos and ingredient notes are sent for AI estimation. You choose meal visibility before saving.</p>
    <div className="mt-auto flex flex-col gap-3 pb-3">
      <button disabled={!photoFile} onClick={onGetEstimate} className="rounded-full bg-primary py-3.5 font-semibold text-background disabled:opacity-40">Estimate nutrition</button>
      <button onClick={onSkipPhoto} className="rounded-full border border-border/60 py-3 text-sm font-semibold text-primary">Enter manually</button>
      {onRepeat && <button onClick={onRepeat} className="rounded-2xl border border-border/60 p-3 text-left text-sm text-primary">Repeat recent meal<span className="mt-1 block text-xs text-muted">{recentMealName || 'Recent meal'} · review before saving</span></button>}
    </div>
  </div>
}
