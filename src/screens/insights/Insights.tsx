import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInsights } from '../../hooks/useInsights'
import { Avatar } from '../../components/Avatar'
import { Skeleton } from '../../components/Skeleton'
import type { InsightRange, Insights, InsightCard, Bar } from '../../lib/insights'

type View = 'overview' | 'calories' | 'macros' | 'consistency'
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'calories',    label: 'Calories' },
  { id: 'macros',      label: 'Macros' },
  { id: 'consistency', label: 'Consistency' },
]
const RANGES: InsightRange[] = [7, 30, 90]
const MEAL_COLORS = ['var(--color-teal)', 'var(--color-pink-acc)', 'var(--color-ink)', 'var(--color-line)']

const fmt = (n: number) => Math.round(n).toLocaleString()
const signed = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmt(Math.abs(n))}`

export default function InsightsScreen() {
  const navigate = useNavigate()
  const { view: viewParam } = useParams<{ view?: string }>()
  const view: View = (VIEWS.find((v) => v.id === viewParam)?.id ?? 'overview')
  const [range, setRange] = useState<InsightRange>(7)
  const { insights, user, isLoading, isError, refetch } = useInsights(range)

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="topbar">
        <span className="clay" style={{ fontSize: 29 }}>{VIEWS.find((v) => v.id === view)?.label === 'Overview' ? 'Insights' : VIEWS.find((v) => v.id === view)?.label}</span>
        <button type="button" onClick={() => navigate('/home/profile')} aria-label="Profile" className="no-press">
          <Avatar name={user?.name ?? '?'} photoUrl={user?.photo_url} />
        </button>
      </div>

      {/* ── View switcher ──────────────────────────────────────── */}
      <div className="scroll-hide -mx-5 flex gap-1.5 overflow-x-auto px-5" style={{ marginBottom: 12 }}>
        {VIEWS.map((v) => (
          <button key={v.id} type="button" onClick={() => navigate(v.id === 'overview' ? '/home/insights' : `/home/insights/${v.id}`)}
            className={`pill ${view === v.id ? 'sel' : ''}`} aria-pressed={view === v.id}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Range ──────────────────────────────────────────────── */}
      {view !== 'consistency' ? (
        <div className="flex items-center gap-1" style={{ marginBottom: 16 }}>
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} className={`pill ${range === r ? 'sel' : ''}`} style={{ padding: '7px 13px' }} aria-pressed={range === r}>
              {r} days
            </button>
          ))}
          <span className="small muted" style={{ marginLeft: 'auto' }}>
            {view === 'calories' && user?.calorie_goal ? `Daily target ${fmt(user.calorie_goal)}` : view === 'macros' ? 'Daily averages' : insights?.range.label ?? ''}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1" style={{ marginBottom: 16 }}>
          <span className="pill sel" style={{ padding: '7px 13px' }}>28 days</span>
          <span className="small muted" style={{ marginLeft: 'auto' }}>{insights ? `${fmtDay(insights.consistency.from)} – ${fmtDay(insights.consistency.to)}` : ''}</span>
        </div>
      )}

      {isLoading && (
        <>
          <Skeleton className="h-56 !rounded-[27px]" />
          <div className="metrics" style={{ marginTop: 11 }}>
            <Skeleton className="h-20 !rounded-[20px]" /><Skeleton className="h-20 !rounded-[20px]" /><Skeleton className="h-20 !rounded-[20px]" />
          </div>
        </>
      )}

      {isError && (
        <div className="card tint text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
          <h4 style={{ marginTop: 12 }}>Couldn’t load your insights</h4>
          <button type="button" onClick={() => refetch()} className="btn">Try again</button>
        </div>
      )}

      {insights && !insights.range.enough && view !== 'consistency' && (
        <div className="card tint" style={{ marginTop: 0 }}>
          <b className="block font-semibold">Log a few more days</b>
          <p className="small muted">Insights get meaningful after 3 logged days in this period — the numbers below update as you go</p>
        </div>
      )}

      {insights && view === 'overview'    && <Overview i={insights} />}
      {insights && view === 'calories'    && <Calories i={insights} goal={user?.calorie_goal ?? 2000} />}
      {insights && view === 'macros'      && <Macros i={insights} />}
      {insights && view === 'consistency' && <Consistency i={insights} />}
    </div>
  )
}

function fmtDay(key: string) {
  return new Date(key + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Shared pieces ────────────────────────────────────────────────────────────

function WeekChart({ bars, tall = false }: { bars: Bar[]; tall?: boolean }) {
  // Goal line sits at 100% of the bar scale; bars are capped at 108% like the mockup
  const chartH = tall ? 183 : 145
  const padTop = 15, padBottom = 23
  const usable = chartH - padTop - padBottom
  const goalY = padTop + usable * (1 - 100 / 108)
  return (
    <div className={`week-chart ${tall ? 'tall' : ''}`} style={{ '--goal-y': `${goalY}px` } as React.CSSProperties} role="img" aria-label="Daily calories against target">
      {bars.map((b, idx) => (
        <span key={idx} className={`day ${b.over ? 'over' : ''} ${b.pct === 0 ? 'empty' : ''}`} title={b.date ? `${b.date} · ${b.pct}% of target` : `${b.pct}% of target`}>
          <i style={{ '--h': `${Math.min(b.pct, 108) / 108 * 100}%` } as React.CSSProperties} />
          <b>{b.label}</b>
          {idx === bars.length - 1 && <em>goal</em>}
        </span>
      ))}
    </div>
  )
}

function Card({ c }: { c: InsightCard }) {
  return (
    <div className="card insight">
      <div className={`insight-mark ${c.tone}`}>{c.mark}</div>
      <div>
        <b>{c.title}</b>
        <p>{c.body}</p>
      </div>
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ i }: { i: Insights }) {
  const o = i.overview
  const under = o.deltaToGoal >= 0
  return (
    <>
      <div className="card ink" style={{ marginTop: 0, padding: 20 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="caps" style={{ color: 'inherit', opacity: 0.65 }}>Average calories</div>
            <div className="value" style={{ marginTop: 8 }}>{fmt(o.avgCalories)} <small>kcal</small></div>
          </div>
          <div className="delta">
            <span>{o.loggedDays ? `${fmt(Math.abs(o.deltaToGoal))} ${under ? 'under' : 'over'}` : '—'}</span><br />
            <span style={{ opacity: 0.65 }}>daily target</span>
          </div>
        </div>
        <WeekChart bars={o.bars} />
      </div>

      <div className="metrics">
        <div className="metric"><small>On target</small><b>{o.onTargetDays} / {i.range.days}</b><small>days</small></div>
        <div className="metric"><small>Protein goal</small><b style={{ color: 'var(--color-pink-acc)' }}>{o.proteinGoalDays} / {i.range.days}</b><small>days</small></div>
        <div className="metric"><small>Logged</small><b>{o.loggedDays} / {i.range.days}</b><small>days</small></div>
      </div>

      {o.cards.length > 0 && (
        <>
          <div className="section-title"><h3>Your pattern</h3><span>Based on this period</span></div>
          {o.cards.map((c) => <Card key={c.title} c={c} />)}
        </>
      )}
    </>
  )
}

// ── Calories ─────────────────────────────────────────────────────────────────

function Calories({ i, goal }: { i: Insights; goal: number }) {
  const c = i.calories
  const gradient = (() => {
    let acc = 0
    const stops = c.byMeal.map((m, idx) => { const s = `${MEAL_COLORS[idx]} ${acc}% ${acc + m.pct}%`; acc += m.pct; return s })
    if (acc < 100) stops.push(`var(--color-line) ${acc}% 100%`)
    return `conic-gradient(${stops.join(', ')})`
  })()
  return (
    <>
      <div className="metrics">
        <div className="metric"><small>Daily average</small><b>{fmt(c.avg)}</b><small>kcal</small></div>
        <div className="metric"><small>Target range</small><b>{c.onTargetDays} / {i.range.days}</b><small>days</small></div>
        <div className="metric"><small>Difference</small><b style={{ color: c.deltaToGoal >= 0 ? 'var(--color-teal)' : 'var(--color-error)' }}>{signed(-c.deltaToGoal)}</b><small>kcal / day</small></div>
      </div>

      <div className="section-title"><h3>Daily intake</h3><span>Goal line {fmt(goal)}</span></div>
      <div className="card" style={{ marginTop: 0 }}>
        <WeekChart bars={c.bars} tall />
        <div className="tiny muted flex justify-between"><span>Lower</span><span>Within target</span><span>Higher</span></div>
      </div>

      <div className="section-title"><h3>Calories by meal</h3><span>Average share</span></div>
      <div className="card flex items-center gap-4" style={{ marginTop: 0 }}>
        <div className="donut" style={{ background: gradient }}><span>{i.range.days} days</span></div>
        <div className="meal-list">
          {c.byMeal.map((m, idx) => (
            <span key={m.type}><b><i style={{ background: MEAL_COLORS[idx] }} />{m.label}</b><strong>{m.pct}%</strong></span>
          ))}
        </div>
      </div>

      {c.card && <Card c={c.card} />}
    </>
  )
}

// ── Macros ───────────────────────────────────────────────────────────────────

function Macros({ i }: { i: Insights }) {
  const m = i.macros
  // Line chart geometry (viewBox 300×125): top 10 → bottom 105
  const maxV = Math.max(m.protein.goal, ...m.series.map((s) => s.value), 1) * 1.15
  const y = (v: number) => 105 - (v / maxV) * 95
  const xs = m.series.map((_, idx) => 5 + (idx * 290) / Math.max(m.series.length - 1, 1))
  const path = m.series.map((s, idx) => `${idx === 0 ? 'M' : 'L'}${xs[idx].toFixed(1)} ${y(s.value).toFixed(1)}`).join(' ')
  const macroRow = (label: string, stat: { avg: number; goal: number; pct: number }, cls: string, color?: string) => (
    <div>
      <div className="macro-head"><span>{label}</span><b style={color ? { color } : undefined}>{fmt(stat.avg)}{stat.goal ? ` / ${fmt(stat.goal)}g` : 'g'}</b></div>
      <div className={`bar ${cls}`}><i style={{ width: `${stat.pct}%` }} /></div>
    </div>
  )
  return (
    <>
      <div className="card grid gap-3" style={{ marginTop: 0 }}>
        {macroRow('Protein', m.protein, 'protein', 'var(--color-pink-acc)')}
        {macroRow('Carbs', m.carbs, 'neutral')}
        {macroRow('Fat', m.fat, 'neutral')}
      </div>

      <div className="section-title"><h3>Protein by day</h3><span>{m.protein.goal ? `Goal ${fmt(m.protein.goal)}g` : 'No goal set'}</span></div>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="protein-line">
          <svg viewBox="0 0 300 125" role="img" aria-label="Protein intake by day">
            <line className="gridline" x1="0" y1="105" x2="300" y2="105" />
            {m.protein.goal > 0 && <line className="goal-line" x1="0" y1={y(m.protein.goal)} x2="300" y2={y(m.protein.goal)} />}
            <path className="protein-path" d={path} />
            {m.series.map((s, idx) => <circle key={idx} className="protein-dot" cx={xs[idx]} cy={y(s.value)} r="4"><title>{s.label}: {s.value}g</title></circle>)}
          </svg>
        </div>
        <div className="axis-labels">{m.series.map((s, idx) => <span key={idx}>{s.label}</span>)}</div>
      </div>

      <div className="callout"><b>{m.callout.title}</b><p>{m.callout.body}</p></div>

      <div className="section-title"><h3>Best protein sources</h3><span>From logged meals</span></div>
      <div className="card" style={{ marginTop: 0 }}>
        {m.topProtein.length === 0 && <p className="small muted">Name your meals when you log them and your best sources will show up here</p>}
        {m.topProtein.map((t, idx) => (
          <div key={t.name} className="habit-row">
            <span className="habit-icon">{idx + 1}</span>
            <span><b>{t.name}</b><p>{t.count} meal{t.count === 1 ? '' : 's'} this period</p></span>
            <strong>{fmt(t.avgProtein)}g</strong>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Consistency ──────────────────────────────────────────────────────────────

function Consistency({ i }: { i: Insights }) {
  const c = i.consistency
  const header = c.calendar.slice(0, 7).map((d) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(d.date + 'T12:00:00').getDay()])
  return (
    <>
      <div className="metrics">
        <div className="metric"><small>Logged</small><b>{c.loggedDays} / {c.days}</b><small>days</small></div>
        <div className="metric"><small>Current streak</small><b>{c.streak}</b><small>days</small></div>
        <div className="metric"><small>Meals logged</small><b>{c.mealsTotal}</b><small>total</small></div>
      </div>

      <div className="section-title"><h3>Logging history</h3><span>Last {c.days} days</span></div>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="calendar" style={{ gap: 7 }}>
          {header.map((l, idx) => <span key={idx}>{l}</span>)}
          {c.calendar.map((d) => (
            <i key={d.date} className={d.state === 'complete' ? 'on' : d.state === 'partial' ? 'partial' : 'off'} style={{ width: 23, height: 23 }}
              title={`${fmtDay(d.date)} · ${d.state}`} />
          ))}
        </div>
        <div className="tiny muted flex justify-between" style={{ marginTop: 13 }}><span>Missed</span><span>Partial</span><span>Complete</span></div>
      </div>

      <div className="section-title"><h3>Your habits</h3><span>Last {c.days} days</span></div>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="habit-row">
          <span className="habit-icon">☀</span>
          <span><b>Breakfast</b><p>Logged before 10:30 AM</p></span>
          <strong>{c.habits.breakfastPct}%</strong>
        </div>
        <div className="habit-row">
          <span className="habit-icon">◐</span>
          <span><b>Lunch</b><p>{c.habits.lunchPct >= c.habits.dinnerPct && c.habits.lunchPct >= c.habits.breakfastPct ? 'Your most consistent meal' : 'Logged on logging days'}</p></span>
          <strong>{c.habits.lunchPct}%</strong>
        </div>
        <div className="habit-row">
          <span className="habit-icon">☾</span>
          <span><b>Dinner</b><p>{c.habits.dinnerWeekendMissPct >= 50 ? 'Most often missed on weekends' : 'Logged on logging days'}</p></span>
          <strong>{c.habits.dinnerPct}%</strong>
        </div>
      </div>

      <Card c={c.card} />
    </>
  )
}

