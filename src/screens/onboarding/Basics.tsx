import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { TopBar } from '../../components/TopBar'
import { OptionIcon, type IconName } from '../../components/OptionIcon'

type Sex = 'male' | 'female'

const SEX_OPTIONS: { value: Sex; icon: IconName; label: string }[] = [
  { value: 'female', icon: 'female', label: 'Female' },
  { value: 'male',   icon: 'male', label: 'Male' },
]

export default function Basics() {
  const navigate = useNavigate()
  const store = useOnboardingStore()

  // Pre-populate from store (back navigation restores values)
  const [heightFt, setHeightFt] = useState(
    store.heightCm ? String(Math.floor(store.heightCm / 30.48)) : ''
  )
  const [heightIn, setHeightIn] = useState(
    store.heightCm
      ? String(Math.round((store.heightCm / 2.54) % 12))
      : ''
  )
  const [weightKg, setWeightKg]   = useState(store.weightKg ? String(store.weightKg) : '')
  const [age, setAge]             = useState(store.age ? String(store.age) : '')
  const [sex, setSex]             = useState<Sex>(store.sex)
  const [error, setError]         = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ft  = Number(heightFt)
    const ins = Number(heightIn || '0')
    const wt  = Number(weightKg)
    const ag  = Number(age)

    if (!ft || ft < 3 || ft > 8)      { setError('Enter a valid height (3–8 ft).'); return }
    if (ins < 0 || ins > 11)          { setError('Inches must be 0–11.'); return }
    if (!wt || wt < 30 || wt > 300)   { setError('Enter weight in kg (30–300).'); return }
    if (!ag || ag < 10 || ag > 100)   { setError('Enter a valid age (10–100).'); return }

    setError(null)
    const heightCm = (ft * 12 + ins) * 2.54
    store.setBasics({ heightCm, weightKg: wt, age: ag, sex })
    navigate('/onboarding/goal')
  }

  return (
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/welcome" />
      <OnboardingProgress step={1} total={6} />

      <h2>The basics</h2>
      <p className="muted">A few details to calculate your daily target</p>
      <div style={{ height: 28 }} />

      <form onSubmit={handleSubmit}>
        <div className="inline-fields">
          <div className="field">
            <label htmlFor="ht-ft">Height · feet</label>
            <input id="ht-ft" inputMode="numeric" placeholder="5"
              value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ht-in">Inches</label>
            <input id="ht-in" inputMode="numeric" placeholder="8"
              value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="wt">Current weight · kg</label>
          <input id="wt" inputMode="decimal" placeholder="76"
            value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="age">Age</label>
          <input id="age" inputMode="numeric" placeholder="28"
            value={age} onChange={(e) => setAge(e.target.value)} />
        </div>

        <div className="section">
          <span className="caps">Sex used for calorie calculation</span>
          <div className="tile-grid">
            {SEX_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setSex(opt.value)}
                className={`tile ${sex === opt.value ? 'sel' : ''}`} aria-pressed={sex === opt.value}>
                <span className="icon"><OptionIcon name={opt.icon} /></span>
                <b>{opt.label}</b>
                <small>{sex === opt.value ? 'Selected' : 'Tap to choose'}</small>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn">Continue</button>
      </form>
    </div>
  )
}
