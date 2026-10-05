import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { OptionIcon, type IconName } from '../../components/OptionIcon'
import { WheelPicker } from '../../components/WheelPicker'
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, loadUnits, saveUnits, type Units } from '../../lib/units'

type Sex = 'male' | 'female' | 'other'

const SEX_OPTIONS: { value: Sex; icon: IconName; label: string }[] = [
  { value: 'female', icon: 'female', label: 'Female' },
  { value: 'male',   icon: 'male', label: 'Male' },
  { value: 'other',  icon: 'sex_other', label: 'Other' },
]

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const CM = range(120, 230)
const KG = range(30, 250)
const FT = range(3, 8)
const IN = range(0, 11)
const LB = range(66, 550)
const AGES = range(13, 100)

export default function Basics() {
  const navigate = useNavigate()
  const store = useOnboardingStore()

  const [units, setUnits] = useState<Units>(loadUnits)
  // Back navigation restores the earlier answers; a first visit starts mid-range.
  const [heightCm, setHeightCm] = useState(Math.round(store.heightCm || 170))
  const [weightKg, setWeightKg] = useState(Math.round(store.weightKg || 70))
  const [age, setAge]           = useState(store.age || 25)
  // Nothing pre-selected on a first visit; coming back restores the earlier choice.
  const [sex, setSex]           = useState<Sex | null>(store.heightCm ? store.sex : null)
  const [error, setError]       = useState<string | null>(null)

  const { ft, inch } = cmToFeetInches(heightCm)

  function switchUnits(next: Units) {
    setUnits(next)
    saveUnits(next)
  }

  function handleContinue() {
    if (!sex) { setError('Choose Female, Male or Other.'); return }
    setError(null)
    store.setBasics({ heightCm, weightKg, age, sex })
    navigate('/onboarding/goal')
  }

  return (
    <div className="screen onb min-h-screen">
      <OnboardingProgress step={1} total={6} back="/welcome" />

      <h2>Height &amp; weight</h2>
      <p className="muted">Used to work out your daily calorie target</p>

      <div className="units" role="group" aria-label="Units">
        <button type="button" className={units === 'imperial' ? '' : 'off'} onClick={() => switchUnits('imperial')}>Imperial</button>
        <button type="button" role="switch" aria-checked={units === 'metric'} aria-label="Use metric units"
          onClick={() => switchUnits(units === 'metric' ? 'imperial' : 'metric')}
          className={`switch ${units === 'metric' ? '' : 'off'}`} />
        <button type="button" className={units === 'metric' ? '' : 'off'} onClick={() => switchUnits('metric')}>Metric</button>
      </div>

      {units === 'metric' ? (
        <div className="flex gap-2.5">
          <WheelPicker label="Height" values={CM} value={heightCm} onChange={setHeightCm} format={(v) => `${v} cm`} />
          <WheelPicker label="Weight" values={KG} value={Math.min(250, Math.max(30, Math.round(weightKg)))} onChange={setWeightKg} format={(v) => `${v} kg`} />
          <WheelPicker label="Age" values={AGES} value={age} onChange={setAge} />
        </div>
      ) : (
        <div className="flex gap-1.5">
          <WheelPicker label="Feet" values={FT} value={ft} onChange={(v) => setHeightCm(feetInchesToCm(v, inch))} format={(v) => `${v} ft`} />
          <WheelPicker label="Inches" values={IN} value={inch} onChange={(v) => setHeightCm(feetInchesToCm(ft, v))} format={(v) => `${v} in`} />
          <WheelPicker label="Weight" values={LB} value={Math.min(550, Math.max(66, kgToLb(weightKg)))} onChange={(v) => setWeightKg(lbToKg(v))} format={(v) => `${v} lb`} />
          <WheelPicker label="Age" values={AGES} value={age} onChange={setAge} />
        </div>
      )}

      <div className="section">
        <span className="caps">Sex used for calorie calculation</span>
        <div className="tile-grid three">
          {SEX_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => { setSex(opt.value); setError(null) }}
              className={`tile compact ${sex === opt.value ? 'sel' : ''}`} aria-pressed={sex === opt.value}>
              <span className="icon"><OptionIcon name={opt.icon} /></span>
              <b>{opt.label}</b>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="cta-dock">
        <button type="button" onClick={handleContinue} className="btn">Continue</button>
      </div>
    </div>
  )
}
