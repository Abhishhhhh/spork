import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'
import type { GoalType, Pace } from '../../lib/calorieGoal'

const GOAL_OPTIONS: { value: GoalType; icon: string; label: string }[] = [
  { value: 'lose',     icon: '↘', label: 'Lose weight' },
  { value: 'maintain', icon: '≈', label: 'Stay the same' },
  { value: 'gain',     icon: '↗', label: 'Build muscle' },
]

const PACE_OPTIONS: { value: Pace; icon: string; label: string; sub: string }[] = [
  { value: 'slow',        icon: '◌', label: 'Relaxed',    sub: '~0.25 kg/wk' },
  { value: 'recommended', icon: '➝', label: 'Moderate',   sub: '~0.5 kg/wk' },
  { value: 'fast',        icon: '⚡︎', label: 'Aggressive', sub: '~0.75 kg/wk' },
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
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/basics" />
      <OnboardingProgress step={2} total={6} />

      <h2>Your goal</h2>
      <p className="muted">We use this to set the right calorie target for you</p>

      <form onSubmit={handleSubmit}>
        <div className="section">
          <span className="caps">What do you want to achieve?</span>
          <div className="tile-grid three">
            {GOAL_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setGoalType(opt.value)}
                className={`tile compact ${goalType === opt.value ? 'sel' : ''}`} aria-pressed={goalType === opt.value}>
                <span className="icon">{opt.icon}</span>
                <b>{opt.label}</b>
              </button>
            ))}
          </div>
        </div>

        {/* Target weight — only for lose / gain */}
        {goalType !== 'maintain' && (
          <div className="field">
            <label htmlFor="target">
              Target weight · kg{currentWt > 0 ? ` · currently ${currentWt} kg` : ''}
            </label>
            <input id="target" inputMode="decimal"
              placeholder={goalType === 'lose' ? 'e.g. 70' : 'e.g. 80'}
              value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
          </div>
        )}

        {/* Pace */}
        {goalType !== 'maintain' && (
          <div className="section">
            <span className="caps">How fast?</span>
            <div className="tile-grid three">
              {PACE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setPace(opt.value)}
                  className={`tile compact ${pace === opt.value ? 'sel' : ''}`} aria-pressed={pace === opt.value}>
                  <span className="icon">{opt.icon}</span>
                  <span>
                    <b>{opt.label}</b>
                    <small className="block">{opt.sub}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn">Continue</button>
      </form>
    </div>
  )
}
