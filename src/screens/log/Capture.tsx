import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogDraftStore } from '../../store/logDraft'

interface CaptureProps {
  onGetEstimate: () => void
}

export default function Capture({ onGetEstimate }: CaptureProps) {
  const navigate = useNavigate()
  const photoFile = useLogDraftStore((s) => s.photoFile)
  const description = useLogDraftStore((s) => s.description)
  const setPhoto = useLogDraftStore((s) => s.setPhoto)
  const setDescription = useLogDraftStore((s) => s.setDescription)

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate('/home/feed')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <h1 className="mb-6 text-2xl font-bold text-primary">Log a meal</h1>

      <label className="mb-4 flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-border/60 text-center text-sm text-muted">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          'Tap to take a photo'
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) setPhoto(file)
          }}
        />
      </label>

      <label className="mb-2 text-sm font-semibold text-muted" htmlFor="description">
        Add details (improves accuracy)
      </label>
      <input
        id="description"
        placeholder='e.g. "3 breads and 5 eggs" or "200g rice, 400g chicken breast"'
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mb-6 rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
      />

      <button
        disabled={!photoFile}
        onClick={onGetEstimate}
        className="mt-auto rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
      >
        Get Estimate
      </button>
    </div>
  )
}
