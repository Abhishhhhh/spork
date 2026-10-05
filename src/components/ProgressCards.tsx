import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useLogWeight, useProgress, useUpdateBodyStats } from '../hooks/useProgress'
import { getEffectiveStreak } from '../lib/streak'
import {
  BMI_STOPS, bmi, caloriesByMacro, daysToNextWeighIn, goalProgress, thisWeekDots, weighInsInRange,
  type WeighIn, type WeightRange,
} from '../lib/progress'
import { OptionIcon } from './OptionIcon'
import { RulerSlider } from './RulerSlider'
import { WheelPicker } from './WheelPicker'
import { useToast } from './Toast'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const fmt = (n: number) => Math.round(n).toLocaleString()
const kg = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}`

type Sheet = 'weight' | 'goal' | 'height' | null

/** Progress cards at the top of Insights → Overview. */
export function ProgressSection() {
  const { data: user } = useCurrentUser()
  const { data } = useProgress()
  const [sheet, setSheet] = useState<Sheet>(null)

  if (!user || !data) return null
  const weighIns = data.weighIns
  const latest = weighIns?.[weighIns.length - 1]?.weight_kg ?? null
  const streak = getEffectiveStreak(user.streak_count, user.streak_last_log_date, new Date())
  const week = thisWeekDots(data.logs.map((l) => l.created_at))

  return (
    <div style={{ marginBottom: 6 }}>
      <div className={weighIns ? 'grid grid-cols-2 gap-2.5' : ''}>
        {weighIns && <WeightCard weighIns={weighIns} targetKg={user.target_weight_kg ?? null} onLog={() => setSheet('weight')} onGoal={() => setSheet('goal')} />}
        <div className="card text-center" style={{ margin: 0 }}>
          <span style={{ color: '#ff9f43' }}><OptionIcon name="flame" size={30} /></span>
          <div className="kpi">{streak}</div>
          <div className="small font-semibold" style={{ color: '#ff9f43' }}>Day streak</div>
          <div className="week-dots" aria-label={`Logged on ${week.days.filter(Boolean).length} days this week`}>
            {week.days.map((on, i) => (
              <div key={i}><i className={`${on ? 'on' : ''} ${i === week.today && !on ? 'today' : ''}`} />{DAY_LETTERS[i]}</div>
            ))}
          </div>
        </div>
      </div>

      {weighIns && weighIns.length > 0 && <GoalProgressCard weighIns={weighIns} targetKg={user.target_weight_kg ?? null} />}
      <CaloriesByMacroCard logs={data.logs} goal={user.calorie_goal} />
      {weighIns && <BmiCard heightCm={user.height_cm ?? null} weightKg={latest} onAddHeight={() => setSheet('height')} />}

      {sheet && (
        <BodySheet mode={sheet} onClose={() => setSheet(null)}
          start={sheet === 'height' ? user.height_cm ?? 170 : sheet === 'goal' ? user.target_weight_kg ?? latest ?? 70 : latest ?? 70}
          firstWeight={weighIns?.[0]?.weight_kg ?? null} />
      )}
    </div>
  )
}

// ── Weight ───────────────────────────────────────────────────────────────────
function WeightCard({ weighIns, targetKg, onLog, onGoal }: { weighIns: WeighIn[]; targetKg: number | null; onLog: () => void; onGoal: () => void }) {
  const latest = weighIns[weighIns.length - 1]?.weight_kg
  const progress = goalProgress(weighIns, targetKg)
  const due = daysToNextWeighIn(weighIns)
  return (
    <div className="card" style={{ margin: 0 }}>
      <span className="caps">My weight</span>
      <div className="kpi" style={{ marginTop: 6 }}>{latest != null ? kg(latest) : '—'} <small className="muted" style={{ font: '14px var(--font-sans)' }}>kg</small></div>
      {progress != null && <div className="meter" style={{ margin: '10px 0 8px' }}><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      <button type="button" onClick={onGoal} className="tiny muted block text-left" style={{ marginTop: progress != null ? 0 : 8 }}>
        {targetKg ? `Goal ${kg(targetKg)} kg` : 'Set a goal weight →'}
      </button>
      <p className="tiny muted">{weighIns.length === 0 ? 'Log your first weigh-in' : due === 0 ? 'Weigh-in due today' : `Next weigh-in in ${due}d`}</p>
      <button type="button" onClick={onLog} className="pill sel" style={{ marginTop: 10 }}>+ Log weight</button>
    </div>
  )
}

const RANGES: { id: WeightRange; label: string }[] = [
  { id: 30, label: '30 days' }, { id: 90, label: '90 days' }, { id: 180, label: '6 months' }, { id: 'all', label: 'All' },
]

function GoalProgressCard({ weighIns, targetKg }: { weighIns: WeighIn[]; targetKg: number | null }) {
  const [range, setRange] = useState<WeightRange>(90)
  const points = weighInsInRange(weighIns, range)
  const progress = goalProgress(weighIns, targetKg)

  const W = 320, H = 140, PADL = 30, PADY = 12
  const values = points.map((p) => p.weight_kg).concat(targetKg ? [targetKg] : [])
  const lo = Math.floor(Math.min(...values) - 0.5), hi = Math.ceil(Math.max(...values) + 0.5)
  const y = (v: number) => PADY + (H - 2 * PADY) * (1 - (v - lo) / Math.max(1, hi - lo))
  const x = (i: number) => PADL + (points.length === 1 ? (W - PADL) / 2 : ((W - PADL - 8) * i) / (points.length - 1))
  const ticks = [hi, Math.round((hi + lo) / 2), lo]

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <b className="font-semibold">Goal progress</b>
        {progress != null && <span className="pill tint">{Math.round(progress * 100)}% of goal</span>}
      </div>
      <div className="seg" role="group" aria-label="Range">
        {RANGES.map((r) => <button key={r.id} type="button" className={range === r.id ? 'on' : ''} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
      </div>
      {points.length === 0 ? (
        <p className="small muted" style={{ padding: '24px 0', textAlign: 'center' }}>No weigh-ins in this period</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Weight from ${kg(points[0].weight_kg)} to ${kg(points[points.length - 1].weight_kg)} kg`}>
          {ticks.map((t) => (
            <g key={t}><line x1={PADL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" /><text x={0} y={y(t) + 4} fontSize="10" fill="var(--color-quiet)">{t}</text></g>
          ))}
          {targetKg && <><line x1={PADL} x2={W} y1={y(targetKg)} y2={y(targetKg)} stroke="var(--color-teal)" strokeDasharray="4 4" /><text x={W - 26} y={y(targetKg) - 5} fontSize="10" fill="var(--color-teal)">goal</text></>}
          <polyline fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points.map((p, i) => `${x(i)},${y(p.weight_kg)}`).join(' ')} />
          <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].weight_kg)} r="5" fill="var(--color-ink)" />
        </svg>
      )}
      {weighIns.length === 1 && <p className="tiny muted text-center">Log again next week to see your trend</p>}
    </div>
  )
}

// ── Calories by macro ────────────────────────────────────────────────────────
const WEEKS = ['This week', 'Last week', '2 wks ago', '3 wks ago']

function CaloriesByMacroCard({ logs, goal }: { logs: Parameters<typeof caloriesByMacro>[0]; goal: number | null }) {
  const [weeksAgo, setWeeksAgo] = useState(0)
  const days = caloriesByMacro(logs, weeksAgo)
  const logged = days.filter((d) => d.calories > 0)
  const avg = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : 0
  const top = Math.max(goal ?? 0, ...days.map((d) => d.calories), 1)
  const BAR_H = 130

  return (
    <div className="card">
      <b className="font-semibold">Calories by macro</b>
      <div className="seg" role="group" aria-label="Week">
        {WEEKS.map((label, i) => <button key={label} type="button" className={weeksAgo === i ? 'on' : ''} aria-pressed={weeksAgo === i} onClick={() => setWeeksAgo(i)}>{label}</button>)}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="kpi">{logged.length ? fmt(avg) : '—'}</span>
        <span className="small muted">{logged.length ? 'kcal avg per logged day' : 'Nothing logged this week'}</span>
      </div>
      <div className="relative flex items-end justify-between" style={{ height: BAR_H, marginTop: 14, padding: '0 4px' }} role="img"
        aria-label={days.map((d, i) => `${DAY_LETTERS[i]} ${fmt(d.calories)} kcal`).join(', ')}>
        {goal ? <div className="absolute left-0 right-0" style={{ top: BAR_H * (1 - goal / top), borderTop: '1.5px dashed var(--color-soft2)' }} /> : null}
        {days.map((d, i) => {
          const h = d.calories ? Math.max(8, (BAR_H * d.calories) / top) : 6
          const split = d.protein + d.carbs + d.fat > 0
          return (
            <div key={i} style={{ width: 24, height: h, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', background: 'var(--color-soft2)' }}>
              {d.calories > 0 && split && <>
                <i style={{ height: `${d.protein * 100}%`, background: 'var(--macro-protein)' }} />
                <i style={{ height: `${d.carbs * 100}%`, background: 'var(--macro-carbs)' }} />
                <i style={{ height: `${d.fat * 100}%`, background: 'var(--macro-fat)' }} />
              </>}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between tiny muted" style={{ padding: '6px 6px 0' }}>{DAY_LETTERS.map((l, i) => <span key={i}>{l}</span>)}</div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span><i className="macro-dot" style={{ background: 'var(--macro-protein)' }} />Protein</span>
        <span><i className="macro-dot" style={{ background: 'var(--macro-carbs)' }} />Carbs</span>
        <span><i className="macro-dot" style={{ background: 'var(--macro-fat)' }} />Fat</span>
        {goal ? <span style={{ marginLeft: 'auto' }}>┅ goal {fmt(goal)}</span> : null}
      </div>
    </div>
  )
}

// ── BMI ──────────────────────────────────────────────────────────────────────
const BMI_CHIP: Record<string, string> = { Underweight: 'var(--macro-fat)', Healthy: 'var(--color-teal)', Overweight: 'var(--macro-carbs)', Obese: 'var(--color-error)' }

function BmiCard({ heightCm, weightKg, onAddHeight }: { heightCm: number | null; weightKg: number | null; onAddHeight: () => void }) {
  const result = bmi(heightCm, weightKg)
  return (
    <div className="card">
      <b className="font-semibold">Your BMI</b>
      {!result ? (
        <>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>{heightCm ? 'Log your weight to see your BMI' : 'Add your height to see your BMI'}</p>
          {!heightCm && <button type="button" className="pill sel" onClick={onAddHeight}>+ Add height</button>}
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5" style={{ marginTop: 6 }}>
            <span className="kpi">{result.value}</span>
            <span className="pill" style={{ color: BMI_CHIP[result.category], background: 'var(--color-soft)' }}>{result.category}</span>
          </div>
          <div className="bmi-bar" style={{ ['--b1' as string]: `${BMI_STOPS.healthy * 100}%`, ['--b2' as string]: `${BMI_STOPS.overweight * 100}%`, ['--b3' as string]: `${BMI_STOPS.obese * 100}%` }}>
            <b style={{ left: `${result.position * 100}%` }} />
          </div>
          <div className="legend">
            {Object.entries(BMI_CHIP).map(([k, c]) => <span key={k}><i className="macro-dot" style={{ background: c }} />{k}</span>)}
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>BMI is a rough guide — it doesn’t account for muscle, age or body shape.</p>
        </>
      )}
    </div>
  )
}

// ── Log weight / goal / height sheet ─────────────────────────────────────────
const CM = Array.from({ length: 111 }, (_, i) => 120 + i)

function BodySheet({ mode, start, firstWeight, onClose }: { mode: Exclude<Sheet, null>; start: number; firstWeight: number | null; onClose: () => void }) {
  const logWeight = useLogWeight()
  const updateStats = useUpdateBodyStats()
  const { toast } = useToast()
  const [value, setValue] = useState(mode === 'height' ? Math.round(start) : Math.round(start * 10) / 10)
  const saving = logWeight.isPending || updateStats.isPending
  const title = mode === 'weight' ? 'Log weight' : mode === 'goal' ? 'Goal weight' : 'Your height'

  async function save() {
    try {
      if (mode === 'weight') await logWeight.mutateAsync(value)
      else await updateStats.mutateAsync(mode === 'goal' ? { target_weight_kg: value } : { height_cm: value })
      toast('Saved ✓')
      onClose()
    } catch {
      toast('Couldn’t save — try again', 'error')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/70 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[430px] rounded-t-[36px] bg-canvas px-5 pb-8 pt-4 animate-slide-up" role="dialog" aria-label={title}>
        <div className="topbar" style={{ marginBottom: 6 }}>
          <span style={{ width: 42 }} />
          <span className="clay">{title}</span>
          <button type="button" onClick={onClose} className="circle" aria-label="Close">✕</button>
        </div>
        {mode === 'height' ? (
          <div className="flex justify-center" style={{ margin: '10px 0 6px' }}>
            <div style={{ width: 160 }}><WheelPicker label="Height" values={CM} value={value} onChange={setValue} format={(v) => `${v} cm`} /></div>
          </div>
        ) : (
          <div className="text-center">
            <p className="caps" style={{ marginTop: 14 }}>{mode === 'weight' ? `Today · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Where you want to be'}</p>
            <div className="stat" style={{ fontSize: 40, marginTop: 6 }}>{kg(value)} kg</div>
            <RulerSlider label={title} min={30} max={250} value={value} onChange={setValue} />
            {mode === 'weight' && firstWeight != null && Math.abs(value - firstWeight) >= 0.1 && (
              <span className="pill tint">{value < firstWeight ? '−' : '+'}{kg(Math.abs(value - firstWeight))} kg since your first weigh-in</span>
            )}
          </div>
        )}
        <button type="button" onClick={save} disabled={saving} className="btn" style={{ marginTop: 22, padding: 16, fontSize: 15 }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>,
    document.body,
  )
}
