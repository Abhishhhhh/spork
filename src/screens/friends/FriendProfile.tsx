import { useNavigate, useParams } from 'react-router-dom'
import { useFriendProfile } from '../../hooks/useFriendProfile'
import { computeAverageCalories, computeMostLoggedMealType } from '../../lib/friendStats'
import { getEffectiveStreak } from '../../lib/streak'

export default function FriendProfile() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useFriendProfile(username)

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Something went wrong loading this profile.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Couldn't find that profile.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  const { user, logs } = data
  // Streak/quick-stats are hidden for a private-default user even if some
  // of their individual logs are public — this is a UI-level rule on top
  // of RLS (see spec §5), not a substitute for it: the logs grid below
  // still shows whatever public logs RLS returned, regardless of this flag.
  const showStats = user.privacy_default === 'public'
  const effectiveStreak = getEffectiveStreak(user.streak_count, user.streak_last_log_date, new Date())
  const avgCalories = computeAverageCalories(logs)
  const mostLoggedMealType = computeMostLoggedMealType(logs)

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      <div className="flex flex-col items-center gap-4">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-border/60 text-2xl text-muted">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-center">
          <p className="text-xl font-bold text-primary">{user.name}</p>
          <p className="text-sm text-muted">@{user.username}</p>
        </div>

        {showStats && (
          <div className="flex w-full gap-3">
            <div className="flex-1 rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-primary">🔥 {effectiveStreak}</p>
              <p className="text-xs text-muted">day streak</p>
            </div>
            <div className="flex-1 rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgCalories ?? '—'}</p>
              <p className="text-xs text-muted">avg cal/day</p>
            </div>
          </div>
        )}

        {showStats && mostLoggedMealType && <p className="text-sm text-muted">Most logged: {mostLoggedMealType}</p>}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted">LOGS</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted">No logs to show yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3">
              <span className="text-lg font-bold text-primary">{log.calories_final ?? log.calories_estimate ?? '—'}</span>
              <span className="text-xs capitalize text-muted">{log.meal_type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
