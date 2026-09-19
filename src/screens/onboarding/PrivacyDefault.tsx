import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type PrivacyDefault as PrivacyDefaultValue } from '../../store/onboardingStore'
import { TopBar } from '../../components/TopBar'

const OPTIONS: { value: PrivacyDefaultValue; icon: string; label: string; sub: string }[] = [
  { value: 'public',  icon: '◎', label: 'Public by default',  sub: 'Visible in the friend feed' },
  { value: 'private', icon: '▣', label: 'Private by default', sub: 'Only you can see them' },
]

export default function PrivacyDefault() {
  const navigate = useNavigate()
  const stored = useOnboardingStore((s) => s.privacyDefault)
  const setPrivacyDefault = useOnboardingStore((s) => s.setPrivacyDefault)
  const [value, setValue] = useState<PrivacyDefaultValue>(stored ?? 'public')

  function handleContinue() {
    setPrivacyDefault(value)
    navigate('/onboarding/friends')
  }

  return (
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/profile" />

      <h2>Who sees your meals?</h2>
      <p className="muted">Choose the default for meals you log</p>
      <div style={{ height: 28 }} />

      <div className="list">
        {OPTIONS.map((opt) => {
          const sel = value === opt.value
          return (
            <button key={opt.value} type="button" onClick={() => setValue(opt.value)}
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

      <p className="hint">You can still choose visibility for each meal before saving</p>

      <button type="button" onClick={handleContinue} className="btn">Continue</button>
    </div>
  )
}
