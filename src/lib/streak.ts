/**
 * The stored `streak_count` only reflects reality if the user logged
 * something today or yesterday — otherwise a streak that was broken days
 * ago would still display as active until the next `log_meal()` call
 * lazily corrects it (see the design spec's streak logic notes). This
 * derives what should actually be *displayed* right now without needing
 * a background job.
 */
export function getEffectiveStreak(streakCount: number, streakLastLogDate: string | null, today: Date): number {
  if (!streakLastLogDate) return 0

  const last = new Date(streakLastLogDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((todayMidnight.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  return diffDays <= 1 ? streakCount : 0
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Run once, client-side, right after a successful log insert (postLog.ts).
 * Already logged today → no change (posting a second meal the same day
 * doesn't double-increment). Last log was yesterday → +1. Any earlier gap
 * (or no prior log at all) → reset to 1. Chosen over a Postgres RPC (spec
 * §10, 2026-08-16) — this app has no realistic concurrent-post race.
 */
export function computeNextStreak(
  streakCount: number,
  streakLastLogDate: string | null,
  today: Date,
): { streak_count: number; streak_last_log_date: string } {
  const todayStr = formatLocalDate(today)

  if (streakLastLogDate === todayStr) {
    return { streak_count: streakCount, streak_last_log_date: todayStr }
  }

  if (!streakLastLogDate) {
    return { streak_count: 1, streak_last_log_date: todayStr }
  }

  const last = new Date(streakLastLogDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((todayMidnight.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  return {
    streak_count: diffDays === 1 ? streakCount + 1 : 1,
    streak_last_log_date: todayStr,
  }
}
