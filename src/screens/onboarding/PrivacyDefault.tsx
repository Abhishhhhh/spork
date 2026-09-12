import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type PrivacyDefault as PrivacyDefaultValue } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

export default function PrivacyDefault() {
  const navigate = useNavigate()
  const setPrivacyDefault = useOnboardingStore((s) => s.setPrivacyDefault)

  function choose(value: PrivacyDefaultValue) {
    setPrivacyDefault(value)
    navigate('/onboarding/friends')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate('/onboarding/profile')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={2} total={3} />

      <h1 className="mb-2 text-xl font-bold text-primary">Who sees your meals?</h1>
      <p className="mb-8 text-sm text-muted">Every log can still be flipped individually.</p>

      <div className="flex flex-col gap-3">
        <button onClick={() => choose('public')} className="rounded-2xl border border-primary p-4 text-left">
          <p className="font-semibold text-primary">Public by default</p>
          <p className="text-sm text-muted">Friends see your meals in their feed.</p>
        </button>
        <button onClick={() => choose('private')} className="card p-4 text-left">
          <p className="font-semibold text-primary">Private by default</p>
          <p className="text-sm text-muted">Only you. Nothing shows up on the feed or in stats.</p>
        </button>
      </div>
    </div>
  )
}
