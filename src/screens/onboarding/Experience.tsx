import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type TrackedBefore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'

const TRACKED_OPTIONS: { value: TrackedBefore; icon: string; label: string; sub: string }[] = [
  { value: 'yes',   icon: '✓', label: 'Yes',           sub: 'I know the drill' },
  { value: 'tried', icon: '◌', label: 'Tried briefly', sub: 'Gave up or lost track' },
  { value: 'no',    icon: '✳', label: 'Never',         sub: 'This is new for me' },
]

const CHALLENGE_OPTIONS = [
  { id: 'consistency',  label: 'Staying consistent',    icon: '▦' },
  { id: 'logging_time', label: 'Logging feels tedious', icon: '◷' },
  { id: 'social',       label: 'No accountability',     icon: '♧' },
  { id: 'accuracy',     label: 'Estimating portions',   icon: '№' },
  { id: 'motivation',   label: 'Losing motivation',     icon: '↗' },
  { id: 'complexity',   label: 'Too complicated',       icon: '✧' },
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
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/food" />
      <OnboardingProgress step={5} total={6} />

      <h2>Your experience</h2>
      <p className="muted">Helps us set the right expectations for you</p>

      {/* Tracked before */}
      <div className="section">
        <span className="caps">Have you tracked calories before?</span>
        <div className="list">
          {TRACKED_OPTIONS.map((opt) => {
            const sel = tracked === opt.value
            return (
              <button key={opt.value} type="button" onClick={() => setTracked(opt.value)}
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

      {/* Challenges — multi-select, optional */}
      <div className="section">
        <span className="caps">Biggest challenges · pick all that apply</span>
        <div className="tile-grid">
          {CHALLENGE_OPTIONS.map((opt) => {
            const selected = challenges.includes(opt.id)
            return (
              <button key={opt.id} type="button" onClick={() => toggleChallenge(opt.id)}
                className={`tile compact ${selected ? 'sel' : ''}`} aria-pressed={selected}>
                <span className="icon">{opt.icon}</span>
                <b>{opt.label}</b>
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="button" onClick={handleContinue} className="btn">Continue</button>
    </div>
  )
}
