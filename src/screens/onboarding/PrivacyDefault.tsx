import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type PrivacyDefault as PrivacyDefaultValue } from '../../store/onboardingStore'

export default function PrivacyDefault() {
  const navigate = useNavigate()
  const setPrivacyDefault = useOnboardingStore((s) => s.setPrivacyDefault)

  function choose(value: PrivacyDefaultValue) {
    setPrivacyDefault(value)
    navigate('/onboarding/friends')
  }

  return (
    <div className="flex min-h-screen flex-col justify-center gap-4 px-6">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Who sees your logs?</h1>
      <p className="mb-6 text-sm text-neutral-500">
        You can change this anytime, and override it for any single log.
      </p>
      <button onClick={() => choose('public')} className="rounded-2xl border border-neutral-200 p-4 text-left">
        <p className="font-semibold text-neutral-900">Public by default</p>
        <p className="text-sm text-neutral-500">Friends see your meals and streak.</p>
      </button>
      <button onClick={() => choose('private')} className="rounded-2xl border border-neutral-200 p-4 text-left">
        <p className="font-semibold text-neutral-900">Private by default</p>
        <p className="text-sm text-neutral-500">Only you see your meals and streak.</p>
      </button>
    </div>
  )
}
