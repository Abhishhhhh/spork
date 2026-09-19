import { type TodayProgress } from '../../lib/logProgress'

/** Today's progress card — calories in teal, protein in pink (the only colour on the screen). */
export default function DailyProgress({ stats, title = 'Today’s progress' }: { stats: TodayProgress; title?: string }) {
  const kcal      = stats.totals.calories
  const kcalGoal  = stats.targets.calories ?? 0
  const kcalPct   = kcalGoal > 0 ? Math.min((kcal / kcalGoal) * 100, 100) : 0
  const over      = kcalGoal > 0 && kcal > kcalGoal
  const protein   = stats.totals.protein
  const protGoal  = stats.targets.protein ?? 0
  const protPct   = protGoal > 0 ? Math.min((protein / protGoal) * 100, 100) : 0

  return (
    <section aria-label={title} className="card tint">
      <span className="caps">{title}</span>
      <div className="flex items-end justify-between" style={{ marginTop: 10 }}>
        <b className="stat">{kcal.toLocaleString()}{kcalGoal > 0 ? ` / ${kcalGoal.toLocaleString()}` : ''}</b>
        <span className="small">kcal</span>
      </div>
      <div className={`bar calories ${over ? 'over' : ''}`} style={{ marginTop: 11 }}>
        <i style={{ width: `${kcalPct}%` }} />
      </div>
      {protGoal > 0 && (
        <>
          <div className="flex items-center justify-between small" style={{ marginTop: 12 }}>
            <span>Protein</span>
            <b className="protein-total">{protein.toLocaleString()} / {protGoal}g</b>
          </div>
          <div className="bar protein" style={{ marginTop: 7 }}>
            <i style={{ width: `${protPct}%` }} />
          </div>
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 10 }}>
        {stats.logCount} meal{stats.logCount === 1 ? '' : 's'} logged
        {stats.missing.calories > 0 ? ' · some meals have no calorie value' : ''}
      </p>
    </section>
  )
}
