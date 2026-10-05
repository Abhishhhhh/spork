import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { OptionIcon, type IconName } from '../../components/OptionIcon'
import { RulerSlider } from '../../components/RulerSlider'
import { PACE_RATES, type GoalType, type Pace } from '../../lib/calorieGoal'
import { kgToLb, loadUnits } from '../../lib/units'

const GOAL_OPTIONS: { value: GoalType; icon: IconName; label: string }[] = [
  { value: 'lose',     icon: 'lose', label: 'Lose weight' },
  { value: 'maintain', icon: 'maintain', label: 'Stay the same' },
  { value: 'gain',     icon: 'gain', label: 'Build muscle' },
]

const PACES: { value: Pace; icon: IconName; label: string }[] = [
  { value: 'slow',        icon: 'slow',     label: 'Relaxed' },
  { value: 'recommended', icon: 'moderate', label: 'Recommended' },
  { value: 'fast',        icon: 'fast',     label: 'Ambitious' },
]

const round1 = (n: number) => Math.round(n * 10) / 10

export default function Goal() {
  const navigate = useNavigate()
  const store    = useOnboardingStore()
  const imperial = loadUnits() === 'imperial'
  const currentWt = store.weightKg ?? 70

  const [goalType, setGoalType] = useState<GoalType>(store.goalType)
  const [pace, setPace]         = useState<Pace>(store.pace)
  const defaultTarget = (type: GoalType) => round1(type === 'gain' ? currentWt + 5 : Math.max(30, currentWt - 5))
  const [targetKg, setTargetKg] = useState(() => store.targetWeightKg ?? defaultTarget(store.goalType))
  const [error, setError]       = useState<string | null>(null)

  const diff = round1(Math.abs(targetKg - currentWt))
  const paceIndex = PACES.findIndex((p) => p.value === pace)
  const weekly = goalType === 'maintain' ? 0 : PACE_RATES[goalType][pace]
  const show = (kg: number) => (imperial ? `${kgToLb(kg)} lb` : `${kg.toFixed(1)} kg`)

  function chooseGoal(type: GoalType) {
    setGoalType(type)
    setError(null)
    // Keep the ruler on the right side of today's weight.
    if (type === 'lose' && targetKg >= currentWt) setTargetKg(defaultTarget('lose'))
    if (type === 'gain' && targetKg <= currentWt) setTargetKg(defaultTarget('gain'))
  }

  function handleContinue() {
    if (goalType === 'lose' && targetKg >= currentWt) { setError('Your goal should be below your current weight.'); return }
    if (goalType === 'gain' && targetKg <= currentWt) { setError('Your goal should be above your current weight.'); return }
    setError(null)
    store.setGoal({ goalType, targetWeightKg: goalType !== 'maintain' ? targetKg : null, pace })
    navigate('/onboarding/activity')
  }

  return (
    <div className="screen onb min-h-screen">
      <OnboardingProgress step={2} total={6} back="/onboarding/basics" />

      <h2>What’s your goal?</h2>
      <p className="muted">Sets the right calorie target for you</p>

      <div className="list" style={{ marginTop: 20 }}>
        {GOAL_OPTIONS.map((opt) => {
          const sel = goalType === opt.value
          return (
            <button key={opt.value} type="button" onClick={() => chooseGoal(opt.value)}
              className={`choice ${sel ? 'sel' : ''}`} aria-pressed={sel}>
              <span className="icon"><OptionIcon name={opt.icon} /></span>
              <b className="flex-1">{opt.label}</b>
              {sel && <span className="check">✓</span>}
            </button>
          )
        })}
      </div>

      {goalType !== 'maintain' && (
        <>
          <div className="card text-center" style={{ marginTop: 16 }}>
            <span className="caps">Goal weight</span>
            <div className="stat" style={{ fontSize: 40, marginTop: 8 }}>{show(targetKg)}</div>
            <RulerSlider label="Goal weight" min={30} max={250} value={targetKg} onChange={(v) => { setTargetKg(v); setError(null) }} />
            <span className="pill tint">
              {diff === 0 ? 'Same as today' : `${show(diff).replace(/\.0 kg$/, ' kg')} to ${goalType === 'lose' ? 'lose' : 'gain'}`}
            </span>
          </div>

          <div className="card">
            <span className="caps block text-center">How fast?</span>
            <div className="stat text-center" style={{ fontSize: 30, marginTop: 8 }}>
              {imperial ? `${kgToLb(weekly)} lb` : `${weekly} kg`} <small className="muted" style={{ font: '14px var(--font-sans)' }}>per week</small>
            </div>
            <div className="pace-icons" aria-hidden="true">
              {PACES.map((p, i) => <span key={p.value} className={i === paceIndex ? 'on' : ''}><OptionIcon name={p.icon} size={24} /></span>)}
            </div>
            <input type="range" className="range" min={0} max={2} step={1} value={paceIndex}
              aria-label="How fast" aria-valuetext={PACES[paceIndex].label}
              style={{ ['--fill' as string]: `${paceIndex * 50}%` }}
              onChange={(e) => setPace(PACES[Number(e.target.value)].value)} />
            <div className="range-scale">{PACES.map((p) => <span key={p.value}>{p.label}</span>)}</div>
          </div>
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="cta-dock">
        <button type="button" onClick={handleContinue} className="btn">Continue</button>
      </div>
    </div>
  )
}
