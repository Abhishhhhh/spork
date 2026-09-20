import { useEffect, useMemo, useState } from 'react'
import { useLogDraftStore, type MealType, type Satiety } from '../../store/logDraft'
import { useTodayStats } from '../../hooks/useTodayStats'

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snack',     label: 'Snack' },
]

const PORTION_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: '½' },
  { value: 1,   label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2,   label: '2×' },
]

const SATIETY_OPTIONS: { value: Satiety; label: string }[] = [
  { value: 'loved_it',  label: 'Loved it' },
  { value: 'good',      label: 'Good' },
  { value: 'okay',      label: 'Okay' },
  { value: 'not_great', label: 'Not great' },
]

const CONFIDENCE_LABELS = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
}

interface EstimateEditProps {
  onBack: () => void
  onPost: () => void
  posting: boolean
  postError: string | null
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

  const confidenceLabel = estimate?.parsed.confidence ? CONFIDENCE_LABELS[estimate.parsed.confidence] : null
  const kcalAfterThisMeal = (stats?.caloriesLogged ?? 0) + (calories ?? 0)
  const goal = stats?.calorieGoal ?? 0
  const willExceedGoal = goal > 0 && kcalAfterThisMeal > goal
  const items = estimate?.parsed.items ?? []

  return (
    <div>
      {/* Top bar */}
      <div className="topbar">
        <button type="button" onClick={onBack} aria-label="Back" className="circle">←</button>
        <span className="clay">{estimate ? 'Review meal' : 'Add details'}</span>
        <span style={{ width: 42 }} />
      </div>

      {/* Photo preview */}
      {previewUrl && <img src={previewUrl} alt="" className="photo natural" style={{ maxHeight: 260 }} />}

      {/* Estimate summary */}
      <div className="card tint">
        <div className="flex items-center justify-between">
          <span>
            <span className="caps">{estimate ? 'Estimated calories' : 'Calories'}</span>
            <h3>{calories != null ? `${calories.toLocaleString()} kcal` : '—'}</h3>
          </span>
          <span className="pill">{confidenceLabel ?? 'Editable'}</span>
        </div>
        <div className="divider" />
        <div className="flex items-center justify-between small">
          <span>Protein <b className="protein-total">{proteinG ?? '—'}g</b></span>
          <span>Carbs <b>{carbsG ?? '—'}g</b></span>
          <span>Fat <b>{fatG ?? '—'}g</b></span>
        </div>
        {stats && goal > 0 && (
          <p className={`tiny ${willExceedGoal ? 'text-error' : 'muted'}`} style={{ marginTop: 10 }}>
            {willExceedGoal
              ? `${(kcalAfterThisMeal - goal).toLocaleString()} kcal over today’s goal`
              : `${(goal - kcalAfterThisMeal).toLocaleString()} kcal left today after this meal`}
          </p>
        )}
      </div>

      {/* AI item breakdown — collapsible */}
      {items.length > 0 && (
        <div className="card" style={{ marginTop: 0 }}>
          <button type="button" onClick={() => setShowItemBreakdown((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
            <span className="min-w-0">
              <b className="block font-semibold">AI detected {items.length} item{items.length > 1 ? 's' : ''}</b>
              <small className="muted block truncate">{items.map((i) => i.name).join(', ')}</small>
            </span>
            <span className="muted">{showItemBreakdown ? '▴' : '▾'}</span>
          </button>
          {showItemBreakdown && items.map((item, idx) => (
            <div key={idx} className="meal-row items-center justify-between" style={{ marginBottom: 0 }}>
              <span>
                <b className="block text-[13px] font-semibold">{item.name}</b>
                <small className="muted">P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g</small>
              </span>
              <b className="font-semibold">{item.calories} kcal</b>
            </div>
          ))}
        </div>
      )}

      {/* Editable macro fields */}
      <div className="inline-fields">
        {([
          { key: 'calories' as const, label: 'Calories (kcal)', val: calories },
          { key: 'proteinG' as const, label: 'Protein · g',     val: proteinG },
          { key: 'carbsG'   as const, label: 'Carbs · g',       val: carbsG },
          { key: 'fatG'     as const, label: 'Fat · g',         val: fatG },
        ] as const).map(({ key, label, val }) => (
          <div key={key} className="field">
            <label htmlFor={`f-${key}`}>{label}</label>
            <input id={`f-${key}`} type="number" min="0" step="1" inputMode="numeric"
              value={val ?? ''}
              onChange={(e) => setField(key, e.target.value === '' ? null : Number(e.target.value))} />
          </div>
        ))}
      </div>

      {/* Meal name */}
      <div className="field">
        <label htmlFor="meal-name">Meal name</label>
        <input id="meal-name" placeholder="e.g. Chicken curry with roti" value={mealName} onChange={(e) => setMealName(e.target.value)} />
      </div>

      {/* Social caption */}
      <div className="field">
        <label htmlFor="caption">Caption · optional</label>
        <input id="caption" placeholder="Add a caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>

      {/* Meal type */}
      <div className="section">
        <span className="caps">Meal type</span>
        <div className="num-pills">
          {MEAL_TYPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setMealType(opt.value)}
              className={`num-pill ${mealType === opt.value ? 'sel' : ''}`} aria-pressed={mealType === opt.value}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Portion multiplier */}
      {estimate && (
        <div className="section">
          <span className="caps">Portion</span>
          <div className="num-pills">
            {PORTION_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setPortionMultiplier(opt.value)}
                className={`num-pill ${portionMultiplier === opt.value ? 'sel' : ''}`} aria-pressed={portionMultiplier === opt.value}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* How was it? */}
      <div className="section">
        <span className="caps">How was it? · optional</span>
        <div className="num-pills">
          {SATIETY_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSatiety(satiety === opt.value ? null : opt.value)}
              className={`num-pill ${satiety === opt.value ? 'sel' : ''}`} aria-pressed={satiety === opt.value}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span>
            <span className="block">Visible to friends</span>
            <small className="muted">{visibility === 'public' ? 'Appears on the feed' : 'Only you can see this'}</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={visibility === 'public'}
            aria-label="Visible to friends"
            onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
            className={`switch ${visibility === 'public' ? '' : 'off'}`}
          />
        </div>
      </div>

      {postError && <p className="error-text">{postError}</p>}

      {/* Post button */}
      <button type="button" disabled={posting || calories === null} onClick={onPost} className="btn">
        {posting ? 'Posting…' : postError ? 'Retry' : 'Post meal'}
      </button>
    </div>
  )
}
