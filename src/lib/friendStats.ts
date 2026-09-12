export interface FriendStatLog {
  calories_final: number | null
  calories_estimate: number | null
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  created_at: string
}

/**
 * Average of each day's total calories (falling back to the estimate for
 * any log never edited), averaged across distinct calendar days — so a
 * day with 3 logs doesn't count 3x as much as a day with 1 log.
 */
export function computeAverageCalories(logs: FriendStatLog[]): number | null {
  if (logs.length === 0) return null

  const totalsByDay = new Map<string, number>()
  for (const log of logs) {
    const calories = log.calories_final ?? log.calories_estimate
    if (calories === null) continue
    const day = log.created_at.slice(0, 10)
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + calories)
  }

  if (totalsByDay.size === 0) return null

  const dailyTotals = [...totalsByDay.values()]
  const sum = dailyTotals.reduce((a, b) => a + b, 0)
  return Math.round(sum / dailyTotals.length)
}

export function computeMostLoggedMealType(logs: FriendStatLog[]): string | null {
  if (logs.length === 0) return null

  const counts = new Map<string, number>()
  for (const log of logs) {
    counts.set(log.meal_type, (counts.get(log.meal_type) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [mealType, count] of counts) {
    if (count > bestCount) {
      best = mealType
      bestCount = count
    }
  }
  return best
}

/** Distinct days with at least one log in the last `days` calendar days. */
export function computeWeeklyLoggedDays(logs: FriendStatLog[], days = 14): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const daySet = new Set<string>()
  for (const log of logs) {
    const day = log.created_at.slice(0, 10)
    if (day >= cutoffStr) daySet.add(day)
  }
  return daySet.size
}
