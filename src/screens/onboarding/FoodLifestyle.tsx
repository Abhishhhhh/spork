import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type MealPrepTime, type DietaryPattern } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'

const DIETARY_OPTIONS: { value: DietaryPattern; icon: string; label: string }[] = [
  { value: 'no_restrictions', icon: '✳', label: 'No restrictions' },
  { value: 'vegetarian',      icon: '♧', label: 'Vegetarian' },
  { value: 'vegan',           icon: '♧', label: 'Vegan' },
  { value: 'other',           icon: '✎︎', label: 'Other' },
]

const PREP_OPTIONS: { value: MealPrepTime; icon: string; label: string; sub: string }[] = [
  { value: 'quick',          icon: '⚡︎', label: 'Quick',          sub: 'Under 15 min' },
  { value: 'moderate',       icon: '♨', label: 'Happy to cook',  sub: '15–45 min' },
  { value: 'enjoys_cooking', icon: '✦', label: 'Love cooking',   sub: '45 min+' },
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
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/activity" />
      <OnboardingProgress step={4} total={6} />

      <h2>Food &amp; lifestyle</h2>
      <p className="muted">Helps personalise meal logging and suggestions</p>

      {/* Dietary pattern */}
      <div className="section">
        <span className="caps">Dietary pattern</span>
        <div className="tile-grid">
          {DIETARY_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setDietary(opt.value)}
              className={`tile compact ${dietary === opt.value ? 'sel' : ''}`} aria-pressed={dietary === opt.value}>
              <span className="icon">{opt.icon}</span>
              <b>{opt.label}</b>
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="field">
        <label htmlFor="allergies">Allergies or foods to avoid · optional</label>
        <input id="allergies"
          placeholder="e.g. nuts, dairy, shellfish"
          value={allergies} onChange={(e) => setAllergies(e.target.value)} />
      </div>

      {/* Meal prep time */}
      <div className="section">
        <span className="caps">Meal prep time per day</span>
        <div className="tile-grid three">
          {PREP_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setPrepTime(opt.value)}
              className={`tile compact ${prepTime === opt.value ? 'sel' : ''}`} aria-pressed={prepTime === opt.value}>
              <span className="icon">{opt.icon}</span>
              <span>
                <b>{opt.label}</b>
                <small className="block">{opt.sub}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Meals per day */}
      <div className="section">
        <span className="caps">Preferred meals per day</span>
        <div className="num-pills">
          {MEAL_COUNTS.map((n) => (
            <button key={n} type="button" onClick={() => setMeals(n)}
              className={`num-pill ${meals === n ? 'sel' : ''}`} aria-pressed={meals === n}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep */}
      <div className="section">
        <span className="caps">Sleep hours per night</span>
        <div className="num-pills">
          {SLEEP_OPTIONS.map((h) => (
            <button key={h} type="button" onClick={() => setSleep(h)}
              className={`num-pill ${sleep === h ? 'sel' : ''}`} aria-pressed={sleep === h}>
              {h}
            </button>
          ))}
          <button type="button" onClick={() => setSleep(11)}
            className={`num-pill ${sleep > 10 ? 'sel' : ''}`} aria-pressed={sleep > 10}>
            10+
          </button>
        </div>
      </div>

      <button type="button" onClick={handleContinue} className="btn">Continue</button>
    </div>
  )
}
