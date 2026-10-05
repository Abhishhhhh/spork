import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { Ring } from '../../components/Ring'
import { OptionIcon } from '../../components/OptionIcon'
import { SporkLoader } from '../../components/brand/SporkLoader'
import { computeTimeline, PACE_RATES } from '../../lib/calorieGoal'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWeeks(weeks: number): string {
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.round(weeks / 4.33)
  if (months < 12) return `About ${months} month${months === 1 ? '' : 's'}`
  return `About ${(weeks / 52).toFixed(1)} years`
}

function getTargetDate(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const GOAL_LABELS = { lose: 'Lose weight', maintain: 'Maintain weight', gain: 'Build muscle' }
const PACE_LABELS  = { slow: 'Relaxed', recommended: 'Moderate', fast: 'Aggressive' }

// ── Loading screen ("building your plan") ────────────────────────────────────

const LOADING_STEPS = [
  'Reading your body stats',
  'Working out daily energy',
  'Setting protein, carbs & fat',
  'Your goal date',
]

const RING_R = 82
const RING_C = 2 * Math.PI * RING_R

function PlanLoader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const totalMs = 2400
    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(progressTimer); return 100 }
        return p + 2
      })
    }, totalMs / 50)
    const doneTimer = setTimeout(onDone, totalMs + 200)
    return () => {
      clearInterval(progressTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  // Each step owns an equal slice of the bar; it ticks off once its slice is full.
  const current = Math.min(LOADING_STEPS.length - 1, Math.floor((progress / 100) * LOADING_STEPS.length))

  return (
    <div className="screen flex min-h-screen flex-col items-center justify-center text-center animate-fade-in">
      <div className="relative grid place-items-center" style={{ width: 170, height: 170 }}>
        <svg width={170} height={170} viewBox="0 0 170 170" aria-hidden="true" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={85} cy={85} r={RING_R} fill="none" stroke="var(--color-soft2)" strokeWidth={6} />
          <circle cx={85} cy={85} r={RING_R} fill="none" stroke="var(--color-ink)" strokeWidth={6} strokeLinecap="round"
            strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress / 100)} />
        </svg>
        <SporkLoader size={64} />
      </div>
      <div className="kpi" style={{ fontSize: 40, marginTop: 18 }} aria-hidden="true">{progress}%</div>
      <h2 role="status">Building your plan</h2>
      <ul className="plan-steps">
        {LOADING_STEPS.map((step, i) => {
          const state = progress >= 100 || i < current ? 'done' : i === current ? 'now' : 'todo'
          return (
            <li key={step} className={state}>
              <span className="mark" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
              {step}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function YourPlan() {
  const navigate   = useNavigate()
  const store      = useOnboardingStore()
  const [revealed, setRevealed] = useState(false)

  const calorieGoal = store.calorieGoal ?? 2000
  const proteinGoal = store.proteinGoal ?? 0
  const goalType    = store.goalType
  const pace        = store.pace
  const weightKg    = store.weightKg ?? 0
  const targetKg    = store.targetWeightKg

  // Guard: if basics not filled, restart
  if (!store.weightKg) {
    navigate('/onboarding/basics', { replace: true })
    return null
  }

  const timeline = targetKg
    ? computeTimeline(weightKg, targetKg, goalType, pace)
    : null

  const weeklyRate = PACE_RATES[goalType][pace]

  if (!revealed) {
    return <PlanLoader onDone={() => setRevealed(true)} />
  }

  const proteinKcal = proteinGoal * 4
  const carbsG = Math.round((calorieGoal * 0.4) / 4)
  const fatG   = Math.round((calorieGoal * 0.3) / 9)
  // Each ring shows that macro's share of the day's calories.
  const rings = [
    { label: 'Protein', color: 'var(--macro-protein)', value: `${proteinGoal}g`, share: proteinKcal / calorieGoal },
    { label: 'Carbs',   color: 'var(--macro-carbs)',   value: `${carbsG}g`,      share: 0.4 },
    { label: 'Fat',     color: 'var(--macro-fat)',     value: `${fatG}g`,        share: 0.3 },
  ]
  const change = targetKg ? Math.round(Math.abs(weightKg - targetKg) * 10) / 10 : 0

  return (
    <div className="screen onb min-h-screen animate-slide-up">
      <OnboardingProgress step={6} total={6} back="/onboarding/experience" />

      <div className="text-center" style={{ marginTop: 22 }}>
        <span className="circle mx-auto" style={{ background: 'var(--color-ink)', color: 'var(--color-on-ink)' }} aria-hidden="true">✓</span>
        <h2 style={{ marginTop: 14 }}>Your plan is ready</h2>
        <p className="muted small">
          {GOAL_LABELS[goalType]} · {PACE_LABELS[pace]} pace{weeklyRate > 0 ? ` · ${weeklyRate} kg/wk` : ''}
        </p>
        {timeline && targetKg && change > 0 && (
          <span className="pill tint" style={{ marginTop: 12, fontSize: 12.5, padding: '8px 14px' }}>
            {goalType === 'lose' ? 'Lose' : 'Gain'} {change} kg · {formatWeeks(timeline.weeksToGoal).toLowerCase()}, by {getTargetDate(timeline.weeksToGoal)}
          </span>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <b className="block font-semibold">Your daily targets</b>
        <p className="tiny muted" style={{ marginBottom: 12 }}>You can change these anytime in Settings</p>
        <div className="ring-grid">
          <div className="ring-card">
            <span className="t"><OptionIcon name="flame" size={15} /> Calories</span>
            <Ring progress={1} color="var(--color-ink)">{calorieGoal.toLocaleString()}</Ring>
            <p className="sub">kcal per day</p>
          </div>
          {rings.map((r) => (
            <div key={r.label} className="ring-card">
              <span className="t"><i className="macro-dot" style={{ background: r.color }} />{r.label}</span>
              <Ring progress={r.share} color={r.color}>{r.value}</Ring>
              <p className="sub">per day</p>
            </div>
          ))}
        </div>
      </div>

      <p className="hint">Create a free account to save this plan, log meals and build your streak with friends</p>

      <div className="cta-dock">
        <button type="button" onClick={() => navigate('/onboarding/create-account')} className="btn">
          Save my plan →
        </button>
      </div>
    </div>
  )
}
