import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

type Sex = 'male' | 'female'

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
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button onClick={() => navigate('/welcome')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">←</button>
      <OnboardingProgress step={1} total={6} />

      <h1 className="mb-1 text-xl font-bold text-primary">The basics</h1>
      <p className="mb-8 text-sm text-muted">Used to calculate your personal calorie targets.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Height */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Height</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ht-ft" className="text-xs text-muted">Feet</label>
              <input id="ht-ft" inputMode="numeric" placeholder="6"
                value={heightFt} onChange={(e) => setHeightFt(e.target.value)}
                className="mt-1 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary placeholder:text-muted" />
            </div>
            <div>
              <label htmlFor="ht-in" className="text-xs text-muted">Inches</label>
              <input id="ht-in" inputMode="numeric" placeholder="2"
                value={heightIn} onChange={(e) => setHeightIn(e.target.value)}
                className="mt-1 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary placeholder:text-muted" />
            </div>
          </div>
        </div>

        {/* Weight + Age */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="wt" className="text-xs text-muted">Current weight (kg)</label>
            <input id="wt" inputMode="decimal" placeholder="95"
              value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary" />
          </div>
          <div>
            <label htmlFor="age" className="text-xs text-muted">Age</label>
            <input id="age" inputMode="numeric" placeholder="24"
              value={age} onChange={(e) => setAge(e.target.value)}
              className="mt-1 w-full rounded-xl bg-surface border border-border/60 px-3 py-2.5 text-base text-primary" />
          </div>
        </div>

        {/* Sex */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sex</p>
          <div className="flex gap-2">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button key={s} type="button" onClick={() => setSex(s)}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium capitalize transition-colors ${
                  sex === s ? 'bg-primary text-background' : 'border border-border/60 text-primary'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="submit"
          className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </form>
    </div>
  )
}