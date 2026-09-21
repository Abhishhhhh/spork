import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { useMealDetail, useEditLog } from '../../hooks/useMealDetail'
import { TopBar } from '../../components/TopBar'
import { useToast } from '../../components/Toast'
import type { Database } from '../../lib/database.types'

type LogRow = Database['public']['Tables']['logs']['Row']
type MealType = LogRow['meal_type']
type Satiety = NonNullable<LogRow['satiety']>

// Same options as EstimateEdit (the create form) so both screens feel identical.
const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snack',     label: 'Snack' },
]
const SATIETY_OPTIONS: { value: Satiety; label: string }[] = [
  { value: 'loved_it',  label: 'Loved it' },
  { value: 'good',      label: 'Good' },
  { value: 'okay',      label: 'Okay' },
  { value: 'not_great', label: 'Not great' },
]

type Num = number | null

/**
 * Owner-only edit of an existing post. Mirrors the fields of the create
 * form (EstimateEdit) minus photo/portion: name, caption, macros, meal
 * type, "how was it", visibility. Edits write the *_final columns — the
 * AI estimate is kept so Meal detail can still show "AI estimate was …".
 */
export default function EditPost() {
  const { logId }  = useParams<{ logId: string }>()
  const navigate   = useNavigate()
  const { toast }  = useToast()
  const { session } = useSession()
  const { data, isLoading, isError } = useMealDetail(logId)
  const editLog    = useEditLog()

  const [name,       setName]       = useState('')
  const [caption,    setCaption]    = useState('')
  const [calories,   setCalories]   = useState<Num>(null)
  const [proteinG,   setProteinG]   = useState<Num>(null)
  const [carbsG,     setCarbsG]     = useState<Num>(null)
  const [fatG,       setFatG]       = useState<Num>(null)
  const [mealType,   setMealType]   = useState<MealType>('lunch')
  const [satiety,    setSatiety]    = useState<Satiety | null>(null)
  const [visibility, setVisibility] = useState<LogRow['visibility']>('public')
  const [error,      setError]      = useState<string | null>(null)

  // Seed the form once the log arrives (final value wins over estimate).
  useEffect(() => {
    if (!data) return
    const { log } = data
    setName(log.name ?? '')
    setCaption(log.caption ?? '')
    setCalories(log.calories_final ?? log.calories_estimate)
    setProteinG(log.protein_final_g ?? log.protein_estimate_g)
    setCarbsG(log.carbs_final_g ?? log.carbs_estimate_g)
    setFatG(log.fat_final_g ?? log.fat_estimate_g)
    setMealType(log.meal_type)
    setSatiety(log.satiety)
    setVisibility(log.visibility)
  }, [data])

  const detailPath = `/home/log/${logId}`
  const isOwner = Boolean(data && session && data.log.user_id === session.user.id)

  if (isLoading) {
    return (
      <div>
        <TopBar title="Edit post" back={detailPath} />
        <p className="muted text-center" style={{ padding: 60 }}>Loading…</p>
      </div>
    )
  }
  if (isError || !data || !isOwner) {
    return (
      <div>
        <TopBar title="Edit post" back={detailPath} />
        <div className="card text-center" style={{ padding: 40 }}>
          <h4>{!data || isError ? 'Couldn’t load this meal' : 'You can only edit your own posts'}</h4>
          <button type="button" onClick={() => navigate(-1)} className="btn">Go back</button>
        </div>
      </div>
    )
  }

  const { log, photoSignedUrl } = data

  function handleSave() {
    setError(null)
    if (calories === null) { setError('Calories are required.'); return }
    editLog.mutate(
      {
        logId: log.id,
        name: name.trim() || null,
        caption: caption.trim() || null,
        meal_type: mealType,
        visibility,
        satiety,
        calories_final: calories,
        protein_final_g: proteinG,
        carbs_final_g: carbsG,
        fat_final_g: fatG,
      },
      {
        onSuccess: () => { toast('Post updated ✓'); navigate(detailPath, { replace: true }) },
        onError: (err) => setError(`Could not save — ${(err as { message?: string }).message ?? 'try again'}`),
      },
    )
  }

  const fields = [
    { key: 'calories', label: 'Calories (kcal)', val: calories, set: setCalories },
    { key: 'protein',  label: 'Protein · g',     val: proteinG, set: setProteinG },
    { key: 'carbs',    label: 'Carbs · g',       val: carbsG,   set: setCarbsG },
    { key: 'fat',      label: 'Fat · g',         val: fatG,     set: setFatG },
  ]

  return (
    <div className="animate-fade-in">
      <TopBar title="Edit post" back={detailPath} />

      {photoSignedUrl && <img src={photoSignedUrl} alt={log.name ?? 'Meal photo'} className="photo natural" />}

      <div className="field">
        <label htmlFor="edit-name">Meal name</label>
        <input id="edit-name" placeholder="e.g. Chicken curry with roti" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="edit-caption">Caption · optional</label>
        <input id="edit-caption" placeholder="Add a caption" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} />
      </div>

      <div className="inline-fields">
        {fields.map(({ key, label, val, set }) => (
          <div key={key} className="field">
            <label htmlFor={`edit-${key}`}>{label}</label>
            <input id={`edit-${key}`} type="number" min="0" step="1" inputMode="numeric"
              value={val ?? ''}
              onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
          </div>
        ))}
      </div>

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

      <div className="card">
        <div className="flex items-center justify-between">
          <span>
            <span className="block">Visible to friends</span>
            <small className="muted">{visibility === 'public' ? 'Appears on the feed' : 'Only you can see this'}</small>
          </span>
          <button type="button" role="switch" aria-checked={visibility === 'public'} aria-label="Visible to friends"
            onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
            className={`switch ${visibility === 'public' ? '' : 'off'}`} />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" disabled={editLog.isPending} onClick={handleSave} className="btn">
        {editLog.isPending ? 'Saving…' : 'Save changes'}
      </button>
      <button type="button" onClick={() => navigate(detailPath)} className="btn ghost">Cancel</button>
    </div>
  )
}
