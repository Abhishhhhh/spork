import { nutrientKeys, nutrientStatus, type TodayProgress } from '../../lib/logProgress'

export default function DailyProgress({ stats, title = 'Today · consumed' }: { stats: TodayProgress; title?: string }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-primary">{title}</h2>
      <div className="grid grid-cols-2 gap-4">
        {nutrientKeys.map(key => {
          const unit       = key === 'calories' ? 'kcal' : 'g'
          const incomplete = stats.missing[key] > 0
          const accentClass =
            key === 'calories' ? 'accent-teal' :
            key === 'protein'  ? 'accent-pink' :
            'text-primary'
          return (
            <div key={key}>
              <p className="text-xs capitalize text-muted">
                {key === 'calories' ? 'Calories' : key.charAt(0).toUpperCase() + key.slice(1)}
              </p>
              <p className={`font-display text-lg font-semibold ${accentClass}`}>
                {stats.totals[key].toLocaleString()}{' '}
                <span className="text-xs font-normal text-muted">{unit}{incomplete ? ' known' : ''}</span>
              </p>
              <p className="text-xs text-muted">
                {incomplete ? 'Some meals have no value' : nutrientStatus(stats.totals[key], stats.targets[key], unit)}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        {stats.logCount} meal{stats.logCount === 1 ? '' : 's'} logged · Estimates are a guide, not a score.
      </p>
    </section>
  )
}
