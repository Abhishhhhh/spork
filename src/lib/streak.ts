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
