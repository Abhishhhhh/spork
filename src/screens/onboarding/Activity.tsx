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
import { TopBar } from '../../components/TopBar'

const JOB_OPTIONS: { value: JobActivity; icon: string; label: string; sub: string }[] = [
  { value: 'desk',     icon: '▣', label: 'Desk job',      sub: 'Sitting most of the day' },
  { value: 'on_feet',  icon: '♧', label: 'On my feet',    sub: 'Retail, teaching, service' },
  { value: 'physical', icon: '✳', label: 'Physical job',  sub: 'Manual labour, construction' },
]

const WORKOUT_TYPE_OPTIONS: { value: WorkoutType; icon: string; label: string }[] = [
  { value: 'none',     icon: '◌', label: 'No workouts' },
  { value: 'cardio',   icon: '↗', label: 'Cardio' },
  { value: 'strength', icon: '✦', label: 'Strength' },
  { value: 'mixed',    icon: '∞', label: 'Mixed' },
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
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/goal" />
      <OnboardingProgress step={3} total={6} />

      <h2>Your activity</h2>
      <p className="muted">Tells us how many calories you actually burn daily</p>

      {/* Daily job activity */}
      <div className="section">
        <span className="caps">Daily activity level</span>
        <div className="list">
          {JOB_OPTIONS.map((opt) => {
            const sel = jobActivity === opt.value
            return (
              <button key={opt.value} type="button" onClick={() => setJobActivity(opt.value)}
                className={`choice ${sel ? 'sel' : ''}`} aria-pressed={sel}>
                <span className="icon">{opt.icon}</span>
                <span className="min-w-0 flex-1">
                  <b>{opt.label}</b>
                  <small>{opt.sub}</small>
                </span>
                {sel && <span className="check">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Workout type */}
      <div className="section">
        <span className="caps">Workout type</span>
        <div className="tile-grid">
          {WORKOUT_TYPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setWorkoutType(opt.value)}
              className={`tile compact ${workoutType === opt.value ? 'sel' : ''}`} aria-pressed={workoutType === opt.value}>
              <span className="icon">{opt.icon}</span>
              <b>{opt.label}</b>
            </button>
          ))}
        </div>
      </div>

      {/* Workout days — hidden when no workouts */}
      {workoutType !== 'none' && (
        <div className="section">
          <span className="caps">Workout days per week</span>
          <div className="num-pills">
            {DAYS.filter(d => d > 0).map((d) => (
              <button key={d} type="button" onClick={() => setWorkoutDays(d)}
                className={`num-pill ${workoutDays === d ? 'sel' : ''}`} aria-pressed={workoutDays === d}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live calorie preview card */}
      <div className="card tint">
        <span className="caps">Your daily targets</span>
        {wasClamped && (
          <p className="tiny muted" style={{ marginTop: 6 }}>
            Clamped to the safe minimum ({MIN_SAFE_CALORIES[store.sex].toLocaleString()} kcal) for your pace
          </p>
        )}
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <b className="stat">{calorieGoal.toLocaleString()} <small style={{ font: '12px var(--font-sans)' }}>kcal</small></b>
          <b>{proteinGoal}g protein</b>
        </div>
        <p className="tiny muted" style={{ marginTop: 6 }}>Maintenance · {tdee.toLocaleString()} kcal</p>
      </div>

      <button type="button" onClick={handleContinue} className="btn">Continue</button>
    </div>
  )
}
