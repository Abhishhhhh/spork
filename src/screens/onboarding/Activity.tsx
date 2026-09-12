import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  computeTDEETwoAxis,
  computePacedGoal,
  clampCalorieGoal,
  isSafeCalorieGoal,
  suggestProteinGoal,
  MIN_SAFE_CALORIES,
  type JobActivity,
  type WorkoutType,
} from '../../lib/calorieGoal'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

const JOB_OPTIONS: { value: JobActivity; icon: string; label: string; sub: string }[] = [
  { value: 'desk',     icon: '💻', label: 'Desk job',      sub: 'Sitting most of the day' },
  { value: 'on_feet',  icon: '🚶', label: 'On my feet',    sub: 'Retail, teaching, service' },
  { value: 'physical', icon: '🔨', label: 'Physical job',  sub: 'Manual labour, construction' },
]

const WORKOUT_TYPE_OPTIONS: { value: WorkoutType; icon: string; label: string }[] = [
  { value: 'none',     icon: '🛋️',  label: 'No workouts' },
  { value: 'cardio',   icon: '🏃',  label: 'Cardio' },
  { value: 'strength', icon: '🏋️',  label: 'Strength' },
  { value: 'mixed',    icon: '🤸',  label: 'Mixed' },
]

const DAYS = [0, 1, 2, 3, 4, 5, 6, 7]

export default function Activity() {
  const navigate = useNavigate()
  const store    = useOnboardingStore()

  const [jobActivity, setJobActivity] = useState<JobActivity>('desk')
  const [workoutDays, setWorkoutDays] = useState(store.workoutDaysPerWeek)
  const [workoutType, setWorkoutType] = useState<WorkoutType>(store.workoutType)

  // Guard: if basics not filled, go back
  if (!store.heightCm || !store.weightKg || !store.age) {
    navigate('/onboarding/basics', { replace: true })
    return null
  }

  const tdee = computeTDEETwoAxis({
    weightKg: store.weightKg,
    heightCm: store.heightCm,
    age:      store.age,
    sex:      store.sex,
    jobActivity,
    workoutDaysPerWeek: workoutType === 'none' ? 0 : workoutDays,
    workoutType,
  })

  const rawGoal    = computePacedGoal(tdee, store.goalType, store.pace)
  const calorieGoal = clampCalorieGoal(rawGoal, store.sex)
  const wasClamped  = !isSafeCalorieGoal(rawGoal, store.sex)
  const proteinGoal = suggestProteinGoal(store.weightKg, store.goalType)

  function handleContinue() {
    store.setActivity({
      activityLevel: 'moderate', // legacy field — kept for back-compat
      workoutDaysPerWeek: workoutType === 'none' ? 0 : workoutDays,
      workoutType,
      calorieGoal,
      proteinGoal,
    })
    navigate('/onboarding/food')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={() => navigate('/onboarding/goal')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
      <OnboardingProgress step={3} total={6} />

      <h1 className="mb-1 text-xl font-bold text-primary">Your activity</h1>
      <p className="mb-8 text-sm text-muted">Tells us how many calories you actually burn daily.</p>

      <div className="flex flex-col gap-6">

        {/* Daily job activity */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Daily activity level</p>
          <div className="flex flex-col gap-1.5">
            {JOB_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setJobActivity(opt.value)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  jobActivity === opt.value
                    ? 'bg-primary text-background'
                    : 'bg-surface/80 text-primary'}`}>
                <span className="text-lg w-7 text-center">{opt.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className={`text-xs ${jobActivity === opt.value ? 'text-background/70' : 'text-muted'}`}>{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Workout type */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Workout type</p>
          <div className="grid grid-cols-4 gap-2">
            {WORKOUT_TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setWorkoutType(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 text-sm transition-colors ${
                  workoutType === opt.value
                    ? 'bg-primary text-background'
                    : 'bg-surface/80 text-primary'}`}>
                <span className="text-lg">{opt.icon}</span>
                <span className={`text-[11px] font-medium ${workoutType === opt.value ? 'text-background' : 'text-primary'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Workout days — hidden when no workouts */}
        {workoutType !== 'none' && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Workout days per week
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.filter(d => d > 0).map((d) => (
                <button key={d} type="button" onClick={() => setWorkoutDays(d)}
                  className={`h-10 w-10 rounded-full text-sm font-semibold transition-colors ${
                    workoutDays === d
                      ? 'bg-primary text-background'
                      : 'bg-background text-primary'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live calorie preview card */}
        <div className={`rounded-2xl p-4 ${wasClamped ? 'banner-warning border' : 'bg-background'}`}>
          <p className="text-xs text-muted mb-2">Your daily targets based on this activity</p>
          {wasClamped && (
            <p className="text-xs banner-warning-text mb-2">
              ⚠️ Clamped to safe minimum ({MIN_SAFE_CALORIES[store.sex].toLocaleString()} kcal) for your pace.
            </p>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-primary">{calorieGoal.toLocaleString()}
                <span className="text-sm font-normal text-muted"> kcal/day</span>
              </p>
              <p className="text-xs text-muted">Maintenance: {tdee.toLocaleString()} kcal</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-primary">{proteinGoal}g
                <span className="text-sm font-normal text-muted"> protein</span>
              </p>
              <p className="text-xs text-muted">Daily target</p>
            </div>
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