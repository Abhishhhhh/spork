import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type MealPrepTime, type DietaryPattern } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

const DIETARY_OPTIONS: { value: DietaryPattern; icon: string; label: string }[] = [
  { value: 'no_restrictions', icon: '🍗', label: 'No restrictions' },
  { value: 'vegetarian',      icon: '🥗', label: 'Vegetarian' },
  { value: 'vegan',           icon: '🌱', label: 'Vegan' },
  { value: 'other',           icon: '✏️', label: 'Other' },
]

const PREP_OPTIONS: { value: MealPrepTime; icon: string; label: string; sub: string }[] = [
  { value: 'quick',          icon: '⚡', label: 'Quick',           sub: 'Under 15 min' },
  { value: 'moderate',       icon: '🍳', label: 'Happy to cook',   sub: '15–45 min' },
  { value: 'enjoys_cooking', icon: '👨‍🍳', label: 'Love cooking',   sub: '45 min+' },
]

const MEAL_COUNTS = [1, 2, 3, 4, 5, 6]
const SLEEP_OPTIONS = [5, 6, 7, 8, 9, 10]

export default function FoodLifestyle() {
  const navigate = useNavigate()
  const store    = useOnboardingStore()

  const [dietary, setDietary]     = useState<DietaryPattern>(store.dietaryPattern)
  const [allergies, setAllergies] = useState(store.allergies)
  const [prepTime, setPrepTime]   = useState<MealPrepTime>(store.mealPrepTime)
  const [meals, setMeals]         = useState(store.mealsPerDay)
  const [sleep, setSleep]         = useState(store.sleepHours)

  function handleContinue() {
    store.setFoodLifestyle({
      dietaryPattern: dietary,
      allergies: allergies.trim(),
      mealPrepTime: prepTime,
      mealsPerDay: meals,
      sleepHours: sleep,
    })
    navigate('/onboarding/experience')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={() => navigate('/onboarding/activity')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
      <OnboardingProgress step={4} total={6} />

      <h1 className="mb-1 text-xl font-bold text-primary">Food & lifestyle</h1>
      <p className="mb-8 text-sm text-muted">Helps personalise meal logging and suggestions.</p>

      <div className="flex flex-col gap-6">

        {/* Dietary pattern */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Dietary pattern</p>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setDietary(opt.value)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  dietary === opt.value
                    ? 'bg-primary text-background'
                    : 'bg-surface/80 text-primary'}`}>
                <span className="text-base">{opt.icon}</span>
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Allergies or foods to avoid
            <span className="ml-1 normal-case font-normal">(optional)</span>
          </label>
          <input
            placeholder="e.g. nuts, dairy, shellfish"
            value={allergies} onChange={(e) => setAllergies(e.target.value)}
            className="mt-2 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary placeholder:text-muted" />
        </div>

        {/* Meal prep time */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Meal prep time per day</p>
          <div className="flex gap-2">
            {PREP_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setPrepTime(opt.value)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-colors ${
                  prepTime === opt.value
                    ? 'border-primary bg-primary text-background'
                    : 'border-border text-primary'}`}>
                <span className="text-lg">{opt.icon}</span>
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className={`text-[10px] ${prepTime === opt.value ? 'text-background/70' : 'text-muted'}`}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Meals per day */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Preferred meals per day
          </p>
          <div className="flex gap-2">
            {MEAL_COUNTS.map((n) => (
              <button key={n} type="button" onClick={() => setMeals(n)}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition-colors ${
                  meals === n ? 'bg-primary text-background' : 'bg-background text-primary'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Sleep hours per night
          </p>
          <div className="flex gap-2 flex-wrap">
            {SLEEP_OPTIONS.map((h) => (
              <button key={h} type="button" onClick={() => setSleep(h)}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition-colors ${
                  sleep === h ? 'bg-primary text-background' : 'bg-background text-primary'}`}>
                {h}
              </button>
            ))}
            <button type="button" onClick={() => setSleep(sleep < 5 ? 5 : sleep > 10 ? 10 : sleep)}
              className={`h-10 rounded-full px-3 text-sm font-semibold ${
                sleep > 10 ? 'bg-primary text-background' : 'bg-background text-primary'}`}>
              {sleep > 10 ? `${sleep}h` : '10+'}
            </button>
          </div>
        </div>

        <button onClick={handleContinue}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </div>
    </div>
  )
}