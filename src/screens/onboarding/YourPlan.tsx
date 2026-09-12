import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { computeTimeline, PACE_RATES } from '../../lib/calorieGoal'
import { ForkLogo } from '../../components/ForkLogo'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWeeks(weeks: number): string {
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.round(weeks / 4.33)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  return `${(weeks / 52).toFixed(1)} years`
}

function getTargetDate(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const GOAL_LABELS = { lose: 'Lose weight', maintain: 'Maintain weight', gain: 'Build muscle' }
const GOAL_EMOJIS = { lose: '📉', maintain: '⚖️', gain: '📈' }
const PACE_LABELS  = { slow: 'Relaxed', recommended: 'Recommended', fast: 'Aggressive' }

// ── Loading screen (Noom-style "building your plan") ─────────────────────────

const LOADING_STEPS = [
  'Analysing your body stats…',
  'Calculating your TDEE…',
  'Factoring in your activity…',
  'Setting your macro targets…',
  'Building your personalised plan…',
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-8 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center card bg-background">
        <ForkLogo className="h-10 w-10 text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold text-primary mb-2">Building your plan…</p>
        <p className="text-sm text-muted h-5 transition-all">{LOADING_STEPS[stepIdx]}</p>
      </div>
      <div className="w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{progress}%</p>
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

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 animate-slide-up">
      <button
        onClick={() => navigate('/onboarding/experience')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={6} total={6} />

      <p className="text-sm font-medium text-muted mb-1">Your personalised plan is ready ✨</p>
      <h1 className="text-xl font-bold text-primary mb-6">Here's what we worked out for you</h1>

      {/* The big plan card */}
      <div className="mb-5 rounded-3xl bg-surface shadow-[var(--shadow-card)] overflow-hidden">

        {/* Goal header */}
        <div className="flex items-center gap-3 bg-primary/5 px-5 py-4 border-b border-border">
          <span className="text-2xl">{GOAL_EMOJIS[goalType]}</span>
          <div>
            <p className="font-bold text-primary">{GOAL_LABELS[goalType]}</p>
            <p className="text-sm text-muted">
              {PACE_LABELS[pace]} pace
              {weeklyRate > 0 && ` · ${weeklyRate} kg/week`}
            </p>
          </div>
        </div>

        {/* Daily calorie goal — THE headline number */}
        <div className="px-5 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Your daily calorie target</p>
          <p className="text-7xl font-bold text-primary leading-none">{calorieGoal.toLocaleString()}</p>
          <p className="text-muted mt-1">calories per day</p>

          {proteinGoal > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background border border-border px-4 py-1.5">
              <span className="text-xs text-muted">Protein goal</span>
              <span className="text-sm font-bold text-primary">{proteinGoal}g/day</span>
            </div>
          )}
        </div>

        {/* Timeline — only for lose/gain */}
        {timeline && targetKg && (
          <div className="border-t border-border px-5 py-4 text-center bg-background">
            <p className="text-xs text-muted mb-1">At this pace, you could reach {targetKg}kg in</p>
            <p className="text-xl font-bold text-primary">{formatWeeks(timeline.weeksToGoal)}</p>
            <p className="text-xs text-muted mt-0.5">Estimated by {getTargetDate(timeline.weeksToGoal)}</p>
          </div>
        )}

        {/* Macro split */}
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Suggested macro split</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Protein', value: `${proteinGoal}g`, bgClass: 'bg-background', textClass: 'text-primary' },
              { label: 'Carbs', value: `${Math.round((calorieGoal * 0.4) / 4)}g`, bgClass: 'bg-background', textClass: 'text-primary' },
              { label: 'Fat', value: `${Math.round((calorieGoal * 0.3) / 9)}g`, bgClass: 'bg-background', textClass: 'text-primary' },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl px-2 py-2 ${m.bgClass}`}>
                <p className={`text-sm font-bold ${m.textClass}`}>{m.value}</p>
                <p className={`text-[10px] font-medium ${m.textClass} opacity-70`}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust + save CTA */}
      <div className="mb-5 card/60 bg-background px-4 py-3 text-center">
        <p className="text-xs text-muted">
          💡 Create a free account to save this plan, log meals, and build your streak with friends.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-border">
          <ForkLogo className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-[11px] text-muted">Your data stays private. We never sell it.</p>
      </div>

      <button
        onClick={() => navigate('/onboarding/create-account')}
        className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background"
      >
        Save my plan — it's free →
      </button>

      <button
        onClick={() => navigate('/onboarding/experience')}
        className="mt-3 text-center text-sm text-muted"
      >
        ← Go back
      </button>
    </div>
  )
}