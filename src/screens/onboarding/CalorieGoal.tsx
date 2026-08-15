import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { suggestCalorieGoal, type ActivityLevel, type Sex } from '../../lib/calorieGoal'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary (little exercise)' },
  { value: 'light', label: 'Light (1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (3-5 days/week)' },
  { value: 'active', label: 'Active (6-7 days/week)' },
  { value: 'very_active', label: 'Very active (physical job or 2x/day)' },
]

export default function CalorieGoal() {
  const navigate = useNavigate()
  const setCalorieGoal = useOnboardingStore((s) => s.setCalorieGoal)
  const [showCalculator, setShowCalculator] = useState(false)
  const [goal, setGoal] = useState('2000')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [error, setError] = useState<string | null>(null)

  function handleUseSuggestion() {
    const weight = Number(weightKg)
    const height = Number(heightCm)
    const ageNum = Number(age)

    if (!weight || !height || !ageNum) {
      setError('Fill in weight, height, and age to get a suggestion.')
      return
    }

    setError(null)
    const suggested = suggestCalorieGoal({ weightKg: weight, heightCm: height, age: ageNum, sex, activityLevel })
    setGoal(String(suggested))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const goalNum = Number(goal)

    if (!goalNum || goalNum < 800 || goalNum > 6000) {
      setError('Enter a calorie goal between 800 and 6000.')
      return
    }

    setCalorieGoal(goalNum)
    navigate('/onboarding/privacy')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={2} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Daily calorie goal</h1>
      <p className="mb-8 text-sm text-muted">You can change this any time in settings.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex items-baseline justify-center gap-2">
          <input
            inputMode="numeric"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-40 bg-transparent text-center text-6xl font-bold text-primary outline-none"
          />
          <span className="text-lg text-muted">kcal</span>
        </div>

        <button
          type="button"
          onClick={() => setShowCalculator((v) => !v)}
          className="mx-auto rounded-full bg-border/60 px-5 py-2 text-sm font-medium text-primary"
        >
          {showCalculator ? 'Hide calculator' : 'Not sure? Suggest one for me'}
        </button>

        {showCalculator && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted">Height cm</label>
                <input
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Weight kg</label>
                <input
                  inputMode="decimal"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Age</label>
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSex('male')}
                className={`flex-1 rounded-full py-2 text-sm font-medium ${sex === 'male' ? 'bg-primary text-background' : 'bg-border/60 text-primary'}`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setSex('female')}
                className={`flex-1 rounded-full py-2 text-sm font-medium ${sex === 'female' ? 'bg-primary text-background' : 'bg-border/60 text-primary'}`}
              >
                Female
              </button>
            </div>

            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleUseSuggestion}
              className="rounded-full bg-border py-2 text-sm font-semibold text-primary"
            >
              Use suggestion
            </button>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="submit" className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </form>
    </div>
  )
}
