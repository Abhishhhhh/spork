import { useLogDraftStore, type MealType } from '../../store/logDraft'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface EstimateEditProps {
  onBack: () => void
  onPost: () => void
  posting: boolean
  postError: string | null
}

export default function EstimateEdit({ onBack, onPost, posting, postError }: EstimateEditProps) {
  const mealName = useLogDraftStore((s) => s.mealName)
  const calories = useLogDraftStore((s) => s.calories)
  const proteinG = useLogDraftStore((s) => s.proteinG)
  const carbsG = useLogDraftStore((s) => s.carbsG)
  const fatG = useLogDraftStore((s) => s.fatG)
  const mealType = useLogDraftStore((s) => s.mealType)
  const visibility = useLogDraftStore((s) => s.visibility)
  const estimate = useLogDraftStore((s) => s.estimate)
  const setMealName = useLogDraftStore((s) => s.setMealName)
  const setField = useLogDraftStore((s) => s.setField)
  const setMealType = useLogDraftStore((s) => s.setMealType)
  const setVisibility = useLogDraftStore((s) => s.setVisibility)

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={onBack}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      <h1 className="mb-2 text-2xl font-bold text-primary">
        {estimate ? 'Review your estimate' : "Couldn't get an estimate"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {estimate ? 'Estimate — tap to adjust.' : 'Enter the details manually.'}
      </p>

      <label className="mb-2 text-sm font-semibold text-muted" htmlFor="mealName">
        Meal name
      </label>
      <input
        id="mealName"
        placeholder="e.g. Greek yoghurt & berries"
        value={mealName}
        onChange={(e) => setMealName(e.target.value)}
        className="mb-4 rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Calories</span>
          <input
            type="number"
            min="0"
            step="1"
            value={calories ?? ''}
            onChange={(e) => setField('calories', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Protein (g)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={proteinG ?? ''}
            onChange={(e) => setField('proteinG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Carbs (g)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={carbsG ?? ''}
            onChange={(e) => setField('carbsG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Fat (g)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={fatG ?? ''}
            onChange={(e) => setField('fatG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
      </div>

      <label className="mb-2 text-sm font-semibold text-muted" htmlFor="mealType">
        Meal type
      </label>
      <select
        id="mealType"
        value={mealType}
        onChange={(e) => setMealType(e.target.value as MealType)}
        className="mb-4 rounded-full bg-border/60 px-5 py-3 text-base capitalize text-primary"
      >
        {MEAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <div className="mb-6 flex items-center justify-between rounded-full border border-border px-5 py-3">
        <span className="text-sm font-semibold text-primary">Visible to friends</span>
        <button
          onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
          aria-label="Toggle visibility"
          className={`h-7 w-12 rounded-full transition-colors ${visibility === 'public' ? 'bg-primary' : 'bg-border'}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-background transition-transform ${
              visibility === 'public' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {postError && <p className="mb-3 text-sm text-error">{postError}</p>}

      <button
        disabled={posting || calories === null}
        onClick={onPost}
        className="mt-auto rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
      >
        {posting ? 'Posting…' : postError ? 'Retry Post' : 'Post'}
      </button>
    </div>
  )
}
