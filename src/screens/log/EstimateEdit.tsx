import { useEffect, useMemo, useState } from 'react'
import { useLogDraftStore, type MealType, type Satiety } from '../../store/logDraft'
import { useTodayStats } from '../../hooks/useTodayStats'

const MEAL_TYPE_OPTIONS: { value: MealType; icon: string; label: string }[] = [
  { value: 'breakfast', icon: '🌅', label: 'Breakfast' },
  { value: 'lunch',     icon: '☀️', label: 'Lunch' },
  { value: 'dinner',    icon: '🌙', label: 'Dinner' },
  { value: 'snack',     icon: '🍎', label: 'Snack' },
]

const PORTION_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: '½' },
  { value: 1,   label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2,   label: '2×' },
]

const SATIETY_OPTIONS: { value: Satiety; icon: string; label: string }[] = [
  { value: 'loved_it',  icon: '😍', label: 'Loved it' },
  { value: 'good',      icon: '👍', label: 'Good' },
  { value: 'okay',      icon: '😐', label: 'Okay' },
  { value: 'not_great', icon: '🤢', label: 'Not great' },
]

const CONFIDENCE_LABELS = {
  high:   { text: 'High confidence',   color: 'text-green-600' },
  medium: { text: 'Medium confidence', color: 'text-muted' },
  low:    { text: 'Low confidence',    color: 'text-error' },
}

interface EstimateEditProps {
  onBack: () => void
  onPost: () => void
  posting: boolean
  postError: string | null
}

function MacroBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right text-xs text-muted">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-xs font-semibold text-primary">{value}g</span>
    </div>
  )
}

export default function EstimateEdit({ onBack, onPost, posting, postError }: EstimateEditProps) {
  const photoFile   = useLogDraftStore((s) => s.photoFile)
  const mealName    = useLogDraftStore((s) => s.mealName)
  const caption     = useLogDraftStore((s) => s.caption)
  const calories    = useLogDraftStore((s) => s.calories)
  const proteinG    = useLogDraftStore((s) => s.proteinG)
  const carbsG      = useLogDraftStore((s) => s.carbsG)
  const fatG        = useLogDraftStore((s) => s.fatG)
  const mealType    = useLogDraftStore((s) => s.mealType)
  const visibility  = useLogDraftStore((s) => s.visibility)
  const satiety     = useLogDraftStore((s) => s.satiety)
  const estimate    = useLogDraftStore((s) => s.estimate)
  const portionMultiplier = useLogDraftStore((s) => s.portionMultiplier)

  const setMealName    = useLogDraftStore((s) => s.setMealName)
  const setCaption     = useLogDraftStore((s) => s.setCaption)
  const setField       = useLogDraftStore((s) => s.setField)
  const setMealType    = useLogDraftStore((s) => s.setMealType)
  const setVisibility  = useLogDraftStore((s) => s.setVisibility)
  const setSatiety     = useLogDraftStore((s) => s.setSatiety)
  const setPortionMultiplier = useLogDraftStore((s) => s.setPortionMultiplier)

  const { data: stats } = useTodayStats()

  const [showItemBreakdown, setShowItemBreakdown] = useState(false)

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const totalMacroG = (proteinG ?? 0) + (carbsG ?? 0) + (fatG ?? 0)
  const confidenceInfo = estimate?.parsed.confidence ? CONFIDENCE_LABELS[estimate.parsed.confidence] : null
  const kcalAfterThisMeal = (stats?.caloriesLogged ?? 0) + (calories ?? 0)
  const goal = stats?.calorieGoal ?? 2000
  const willExceedGoal = kcalAfterThisMeal > goal
  const items = estimate?.parsed.items ?? []

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button onClick={onBack} aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
        <h1 className="text-base font-semibold text-primary">
          {estimate ? 'Review estimate' : 'Add details'}
        </h1>
        <div className="w-9" /> {/* spacer */}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-5">

        {/* Photo preview */}
        {previewUrl && (
          <div className="relative">
            <img src={previewUrl} alt=""
              className="aspect-[4/3] w-full rounded-2xl object-cover" />
            {confidenceInfo && (
              <span className={`absolute top-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold ${confidenceInfo.color}`}>
                {confidenceInfo.text}
              </span>
            )}
          </div>
        )}

        {/* AI item breakdown — collapsible */}
        {items.length > 0 && (
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowItemBreakdown((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-primary">AI detected {items.length} item{items.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted">{items.map((i) => i.name).join(', ')}</p>
              </div>
              <span className="text-muted text-sm">{showItemBreakdown ? '▲' : '▼'}</span>
            </button>
            {showItemBreakdown && (
              <div className="border-t border-border">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-primary">{item.name}</p>
                      <p className="text-xs text-muted">
                        P: {item.protein_g}g · C: {item.carbs_g}g · F: {item.fat_g}g
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-primary">{item.calories} kcal</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Portion multiplier */}
        {estimate && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Portion size</p>
            <div className="flex gap-2">
              {PORTION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setPortionMultiplier(opt.value)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                    portionMultiplier === opt.value
                      ? 'bg-primary text-background'
                      : 'bg-background text-primary'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calorie total + macro bars */}
        <div className="rounded-2xl bg-background p-4">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-2xl font-bold text-primary">
              {calories?.toLocaleString() ?? '—'}
              <span className="text-base font-normal text-muted"> kcal</span>
            </p>
            {stats && (
              <p className={`text-xs font-semibold ${willExceedGoal ? 'text-error' : 'text-muted'}`}>
                {willExceedGoal
                  ? `${(kcalAfterThisMeal - goal).toLocaleString()} over goal`
                  : `${(goal - kcalAfterThisMeal).toLocaleString()} left today`}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <MacroBar label="Protein" value={proteinG ?? 0} total={totalMacroG} color="macro-protein" />
            <MacroBar label="Carbs"   value={carbsG ?? 0}   total={totalMacroG} color="macro-carbs" />
            <MacroBar label="Fat"     value={fatG ?? 0}     total={totalMacroG} color="macro-fat" />
          </div>
        </div>

        {/* Editable macro fields */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Adjust if needed</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'calories' as const, label: 'Calories (kcal)', val: calories },
              { key: 'proteinG' as const, label: 'Protein (g)',     val: proteinG },
              { key: 'carbsG'   as const, label: 'Carbs (g)',       val: carbsG },
              { key: 'fatG'     as const, label: 'Fat (g)',         val: fatG },
            ] as const).map(({ key, label, val }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted">{label}</span>
                <input type="number" min="0" step="1"
                  value={val ?? ''}
                  onChange={(e) => setField(key, e.target.value === '' ? null : Number(e.target.value))}
                  className="rounded-xl bg-surface border border-border/60 px-3 py-2 text-base text-primary" />
              </label>
            ))}
          </div>
        </div>

        {/* Meal name */}
        <div>
          <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Meal name</label>
          <input
            placeholder="e.g. Chicken rice bowl"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-surface border border-border/60 px-4 py-2.5 text-base text-primary placeholder:text-muted"
          />
        </div>

        {/* Social caption */}
        <div>
          <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Caption <span className="normal-case font-normal text-muted">(shows on your feed)</span>
          </label>
          <input
            placeholder='e.g. "Finally nailed my macros 💪"'
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-surface border border-border/60 px-4 py-2.5 text-base text-primary placeholder:text-muted"
          />
        </div>

        {/* Meal type chips */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Meal type</p>
          <div className="flex gap-2">
            {MEAL_TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setMealType(opt.value)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-2.5 text-xs font-semibold transition-colors ${
                  mealType === opt.value
                    ? 'border-primary bg-primary text-background'
                    : 'border-border text-primary'}`}>
                <span className="text-base">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* How did it feel? */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            How was it? <span className="normal-case font-normal">(optional)</span>
          </p>
          <div className="flex gap-2">
            {SATIETY_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => setSatiety(satiety === opt.value ? null : opt.value)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-2.5 text-xs font-semibold transition-colors ${
                  satiety === opt.value
                    ? 'border-primary bg-primary text-background'
                    : 'border-border text-primary'}`}>
                <span className="text-base">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between card px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-primary">Visible to friends</p>
            <p className="text-xs text-muted">{visibility === 'public' ? 'Appears on the feed' : 'Only you can see this'}</p>
          </div>
          <button
            onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
            aria-label="Toggle visibility"
            className={`h-7 w-12 rounded-full transition-colors ${visibility === 'public' ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`block h-5 w-5 translate-y-0 rounded-full bg-background transition-transform mx-auto ${
              visibility === 'public' ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
          </button>
        </div>

        {postError && <p className="text-sm text-error">{postError}</p>}

        {/* Post button */}
        <button
          disabled={posting || calories === null}
          onClick={onPost}
          className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background disabled:opacity-40"
        >
          {posting ? 'Posting…' : postError ? 'Retry' : 'Post 🔥'}
        </button>
      </div>
    </div>
  )
}