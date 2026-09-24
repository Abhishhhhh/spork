import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'
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

  const macros = [
    { label: 'Protein', icon: 'protein' as const, value: `${proteinGoal}g` },
    { label: 'Carbs',   icon: 'carbs' as const,   value: `${Math.round((calorieGoal * 0.4) / 4)}g` },
    { label: 'Fat',     icon: 'fat' as const,     value: `${Math.round((calorieGoal * 0.3) / 9)}g` },
  ]

  return (
    <div className="screen min-h-screen animate-slide-up">
      <TopBar title="Your plan" back="/onboarding/experience" />
      <OnboardingProgress step={6} total={6} />

      <p className="muted small">Your personalised plan is ready ✦</p>
      <h2>Here’s what we worked out for you</h2>

      {/* The big plan card */}
      <div className="card ink">
        <span className="caps">
          {GOAL_LABELS[goalType]} · {PACE_LABELS[pace]} pace{weeklyRate > 0 ? ` · ${weeklyRate} kg/wk` : ''}
        </span>
        <div style={{ height: 28 }} />
        <div className="big">{calorieGoal.toLocaleString()}</div>
        <p>calories per day</p>
        {proteinGoal > 0 && (
          <>
            <div className="divider" />
            <div className="flex items-center justify-between">
              <span>Protein goal</span>
              <b>{proteinGoal}g/day</b>
            </div>
          </>
        )}
      </div>

      {/* Timeline — only for lose/gain */}
      {timeline && targetKg && (
        <div className="card">
          <p className="caps">At this pace, you could reach {targetKg} kg in</p>
          <h3 style={{ marginTop: 8 }}>{formatWeeks(timeline.weeksToGoal)}</h3>
          <p className="small muted">Estimated by {getTargetDate(timeline.weeksToGoal)}</p>
        </div>
      )}

      {/* Macro split */}
      <div className="section">
        <span className="caps">Suggested macro split</span>
        <div className="tile-grid three">
          {macros.map((m) => (
            <div key={m.label} className="tile compact">
              <span className="icon"><OptionIcon name={m.icon} /></span>
              <span>
                <b>{m.value}</b>
                <small className="block">{m.label}</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="hint">Create a free account to save this plan, log meals and build your streak with friends</p>

      <button type="button" onClick={() => navigate('/onboarding/create-account')} className="btn">
        Save my plan →
      </button>
    </div>
  )
}
