import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type TrackedBefore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

const TRACKED_OPTIONS: { value: TrackedBefore; icon: string; label: string; sub: string }[] = [
  { value: 'yes',   icon: '✅', label: 'Yes',          sub: 'I know the drill' },
  { value: 'tried', icon: '🤔', label: 'Tried briefly', sub: 'Gave up or lost track' },
  { value: 'no',    icon: '👋', label: 'Never',         sub: 'This is new for me' },
]

const CHALLENGE_OPTIONS = [
  { id: 'consistency',  label: 'Staying consistent',  icon: '📅' },
  { id: 'logging_time', label: 'Logging feels tedious', icon: '⏱️' },
  { id: 'social',       label: 'No accountability',   icon: '👥' },
  { id: 'accuracy',     label: 'Estimating portions', icon: '🔢' },
  { id: 'motivation',   label: 'Losing motivation',   icon: '🔋' },
  { id: 'complexity',   label: 'Too complicated',     icon: '🧩' },
]

export default function Experience() {
  const navigate = useNavigate()
  const store    = useOnboardingStore()

  const [tracked, setTracked]       = useState<TrackedBefore | null>(store.trackedBefore)
  const [challenges, setChallenges] = useState<string[]>(store.trackingChallenges)
  const [error, setError]           = useState<string | null>(null)

  function toggleChallenge(id: string) {
    setChallenges((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function handleContinue() {
    if (!tracked) { setError('Select one option.'); return }
    setError(null)
    store.setExperience({ trackedBefore: tracked, trackingChallenges: challenges })
    navigate('/onboarding/your-plan')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={() => navigate('/onboarding/food')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
      <OnboardingProgress step={5} total={6} />

      <h1 className="mb-1 text-xl font-bold text-primary">Your experience</h1>
      <p className="mb-8 text-sm text-muted">Helps us set the right expectations for you.</p>

      <div className="flex flex-col gap-6">

        {/* Tracked before */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Have you tracked calories before?
          </p>
          <div className="flex flex-col gap-2">
            {TRACKED_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setTracked(opt.value)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                  tracked === opt.value
                    ? 'bg-primary text-background'
                    : 'bg-surface/80 text-primary'}`}>
                <span className="text-lg w-7 text-center">{opt.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className={`text-xs ${tracked === opt.value ? 'text-background/70' : 'text-muted'}`}>{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Challenges — multi-select, optional */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Biggest challenges
            <span className="ml-1 normal-case font-normal">(pick all that apply)</span>
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {CHALLENGE_OPTIONS.map((opt) => {
              const selected = challenges.includes(opt.id)
              return (
                <button key={opt.id} type="button" onClick={() => toggleChallenge(opt.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selected ? 'bg-primary text-background' : 'bg-surface/80 text-primary'}`}>
                  <span className="text-base">{opt.icon}</span>
                  <span className="text-xs font-medium leading-tight">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button onClick={handleContinue}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </div>
    </div>
  )
}
