import { Link } from 'react-router-dom'
import { useTodayStats } from '../../hooks/useTodayStats'
import { useLogsForDay } from '../../hooks/useProfile'

export default function Today() {
  const now = new Date()
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const stats = useTodayStats()
  const meals = useLogsForDay(dateKey)

  return (
    <main className="today-screen px-5 pt-7 pb-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Today</h1>
        </div>
        <Link to="/home/notifications" className="control-outline text-xs">Inbox</Link>
      </header>
      <p className="mt-2 text-sm text-muted">Your food, one day at a time.</p>

      <section aria-label="Today's nutrition" className="mt-7">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Logged today</p>
        <div className="mt-3 grid grid-cols-2 gap-5">
          <div><p className="text-sm text-muted">Calories</p><p className="mt-1 text-3xl font-semibold tabular-nums">{stats.data?.caloriesLogged.toLocaleString() ?? '—'} <span className="text-sm font-normal text-muted">kcal</span></p></div>
          <div><p className="text-sm text-muted">Protein</p><p className="mt-1 text-3xl font-semibold tabular-nums">{stats.data?.proteinLogged.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'} <span className="text-sm font-normal text-muted">g</span></p></div>
        </div>
        {stats.isPending && <p role="status" className="mt-3 text-sm text-muted">Loading your nutrition…</p>}
        {stats.isError && <div role="alert" className="mt-3 text-sm"><p>Could not update your nutrition. Any values shown may be out of date.</p><button className="control-outline mt-2" onClick={() => void stats.refetch()}>Retry nutrition</button></div>}
        <p className="mt-3 text-xs text-muted">Nutrition estimates from your meal logs.</p>
      </section>

      <Link to="/home/log" className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-background"><span aria-hidden="true">+</span> Log meal</Link>

      <section aria-labelledby="today-meals" className="mt-8">
        <div className="flex items-center justify-between gap-2"><h2 id="today-meals" className="text-lg font-semibold">Your meals</h2><Link to="/home/profile" className="control-outline text-xs">History</Link></div>
        {meals.isPending && <p role="status" className="py-7 text-sm text-muted">Loading your meals…</p>}
        {meals.isError && <div role="alert" className="py-5 text-sm"><p>Could not load your meals.</p><button className="control-outline mt-2" onClick={() => void meals.refetch()}>Retry meals</button></div>}
        {!meals.isPending && !meals.isError && meals.data?.length === 0 && <div className="py-8"><p className="text-sm font-medium">No meals logged yet</p><p className="mt-1 text-sm text-muted">Start with your next bite. Tap Log meal above.</p></div>}
        <ul className="mt-3 divide-y divide-border">
          {meals.data?.map(meal => (
            <li key={meal.id}>
              <Link to={`/home/log/${meal.id}`} className="flex min-h-18 items-center justify-between gap-4 py-4">
                <div className="min-w-0"><p className="break-words text-sm font-medium">{meal.name || 'Untitled meal'}</p><p className="mt-1 text-xs text-muted"><span className="capitalize">{meal.meal_type}</span> · {new Date(meal.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p></div>
                <span className="shrink-0 text-sm tabular-nums">{meal.calories_final ?? meal.calories_estimate ?? '—'} <span className="text-xs text-muted">kcal</span><span aria-hidden="true" className="ml-3 text-muted">›</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-7 flex items-center justify-between gap-3 text-sm"><p className="text-muted">A little company helps.</p><Link to="/home/feed" className="control-outline text-xs">Open feed <span aria-hidden="true">↗</span></Link></div>
      <Link to="/home/rewards" className="mt-4 inline-flex min-h-11 items-center text-xs text-muted underline underline-offset-4">View streaks & rewards</Link>
    </main>
  )
}
