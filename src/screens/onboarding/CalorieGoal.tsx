import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { suggestCalorieGoal, type ActivityLevel } from '../../lib/calorieGoal'
import { useOnboardingStore } from '../../store/onboardingStore'

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
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [goal, setGoal] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [age, setAge] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [error, setError] = useState<string | null>(null)

  function handleAutoSuggest() {
    const weight = Number(weightKg)
    const height = Number(heightCm)
    const ageNum = Number(age)

    if (!weight || !height || !ageNum) {
      setError('Fill in weight, height, and age to get a suggestion.')
      return
    }

    setError(null)
    const suggested = suggestCalorieGoal({ weightKg: weight, heightCm: height, age: ageNum, activityLevel })
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
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Daily calorie goal</h1>
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === 'manual' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}
        >
          I know my goal
        </button>
        <button
          type="button"
          onClick={() => setMode('auto')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === 'auto' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}
        >
          Suggest for me
        </button>
      </div>

      {mode === 'auto' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4">
          <input
            placeholder="Weight (kg)"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <input
            placeholder="Height (cm)"
            inputMode="decimal"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <input
            placeholder="Age"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAutoSuggest}
            className="rounded-xl bg-neutral-900 py-2 text-sm font-semibold text-white"
          >
            Calculate suggestion
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Daily calories"
          inputMode="numeric"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-center text-2xl font-bold"
        />
        <p className="text-center text-xs text-neutral-400">Editable anytime in Settings</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white">
          Next
        </button>
      </form>
    </div>
  )
}
