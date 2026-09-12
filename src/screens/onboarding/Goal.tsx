import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import type { GoalType, Pace } from '../../lib/calorieGoal'

const GOAL_OPTIONS: { value: GoalType; emoji: string; label: string; sub: string }[] = [
  { value: 'lose',     emoji: '📉', label: 'Lose weight',   sub: 'Burn fat, reduce weight' },
  { value: 'maintain', emoji: '⚖️', label: 'Stay the same', sub: 'Eat at maintenance' },
  { value: 'gain',     emoji: '📈', label: 'Build muscle',  sub: 'Lean bulk, add size' },
]

const PACE_OPTIONS: { value: Pace; icon: string; label: string; sub: string }[] = [
  { value: 'slow',        icon: '🦥', label: 'Relaxed',    sub: '~0.25 kg/wk' },
  { value: 'recommended', icon: '🐇', label: 'Moderate',   sub: '~0.5 kg/wk' },
  { value: 'fast',        icon: '🐆', label: 'Aggressive', sub: '~0.75 kg/wk' },
]

export default function Goal() {
  const navigate = useNavigate()
  const store    = useOnboardingStore()

  const [goalType, setGoalType] = useState<GoalType>(store.goalType)
  const [pace, setPace]         = useState<Pace>(store.pace)
  const [targetKg, setTargetKg] = useState(store.targetWeightKg ? String(store.targetWeightKg) : '')
  const [error, setError]       = useState<string | null>(null)

  const currentWt = store.weightKg ?? 0

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (goalType !== 'maintain') {
      const tgt = Number(targetKg)
      if (!tgt || tgt < 30 || tgt > 300) {
        setError('Enter a valid target weight (30–300 kg).')
        return
      }
      if (goalType === 'lose' && tgt >= currentWt) {
        setError('Target must be lower than your current weight.')
        return
      }
      if (goalType === 'gain' && tgt <= currentWt) {
        setError('Target must be higher than your current weight.')
        return
      }
    }
    setError(null)
    store.setGoal({
      goalType,
      targetWeightKg: goalType !== 'maintain' ? Number(targetKg) : null,
      pace,
    })
    navigate('/onboarding/activity')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={() => navigate('/onboarding/basics')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
      <OnboardingProgress step={2} total={6} />

      <h1 className="mb-1 text-xl font-bold text-primary">Your goal</h1>
      <p className="mb-8 text-sm text-muted">We use this to set the right calorie target for you.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Goal type */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">What do you want to achieve?</p>
          <div className="flex gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setGoalType(opt.value)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3.5 transition-colors ${
                  goalType === opt.value
                    ? 'border-primary bg-primary text-background'
                    : 'border-border text-primary'}`}>
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-xs font-semibold leading-tight text-center">{opt.label}</span>
                <span className={`text-[10px] leading-tight text-center ${goalType === opt.value ? 'text-background/70' : 'text-muted'}`}>
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Target weight — only for lose / gain */}
        {goalType !== 'maintain' && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              Target weight (kg) — {goalType === 'lose' ? 'how light?' : 'goal weight?'}
            </label>
            {currentWt > 0 && (
              <p className="mt-0.5 text-xs text-muted">Current: {currentWt} kg</p>
            )}
            <input inputMode="decimal"
              placeholder={goalType === 'lose' ? 'e.g. 80' : 'e.g. 100'}
              value={targetKg} onChange={(e) => setTargetKg(e.target.value)}
              className="mt-2 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary placeholder:text-muted" />
          </div>
        )}

        {/* Pace */}
        {goalType !== 'maintain' && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">How fast?</p>
            <div className="flex gap-2">
              {PACE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPace(opt.value)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3.5 transition-colors ${
                    pace === opt.value
                      ? 'border-primary bg-primary text-background'
                      : 'border-border text-primary'}`}>
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className={`text-[10px] ${pace === opt.value ? 'text-background/70' : 'text-muted'}`}>
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="submit"
          className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </form>
    </div>
  )
}
