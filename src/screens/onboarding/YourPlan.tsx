import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'
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
  'Analysing your body stats',
  'Calculating your TDEE',
  'Factoring in your activity',
  'Setting your macro targets',
  'Calculating your personalised targets',
]

function PlanLoader({ onDone }: { onDone: () => void }) {
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const totalMs = 2400
    const stepMs  = totalMs / LOADING_STEPS.length

    const stepTimer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1))
    }, stepMs)

    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(progressTimer); return 100 }
        return p + 2
      })
    }, totalMs / 50)

    const doneTimer = setTimeout(onDone, totalMs + 200)

    return () => {
      clearInterval(stepTimer)
      clearInterval(progressTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Your plan" back={null} />
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="icon-box" style={{ width: 120, height: 120 }}><SporkLoader size={60} /></div>
        <div style={{ height: 28 }} />
        <h2>Building your plan</h2>
        <p className="muted">{LOADING_STEPS[stepIdx]}</p>
        <div className="progress" style={{ width: 220, marginTop: 30 }}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="tiny muted">{progress}%</p>
      </div>
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
