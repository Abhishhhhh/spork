interface MinimalLog {
  created_at: string
  calories_final: number | null
  calories_estimate: number | null
}

/** Extracts the local date string (yyyy-mm-dd) from an ISO timestamp. */
function toLocalDateStr(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString('en-CA') // 'en-CA' gives yyyy-mm-dd
}

/**
 * Set of distinct log dates (yyyy-mm-dd local) from a list of logs.
 * Used both for the calendar dots and for weekly day-count.
 */
export function buildLogDateSet(logs: MinimalLog[]): Set<string> {
  const set = new Set<string>()
  for (const log of logs) {
    set.add(toLocalDateStr(log.created_at))
  }
  return set
}

/**
 * Average daily calories over the distinct calendar days represented in the log list.
 * Returns null when there are no logs with calorie data.
 */
export function computeWeeklyAvgCalories(logs: MinimalLog[]): number | null {
  // Sum calories per calendar day
  const byDay = new Map<string, number>()
  for (const log of logs) {
    const cal = log.calories_final ?? log.calories_estimate
    if (cal === null) continue
    const day = toLocalDateStr(log.created_at)
    byDay.set(day, (byDay.get(day) ?? 0) + cal)
  }
  if (byDay.size === 0) return null
  const total = [...byDay.values()].reduce((a, b) => a + b, 0)
  return Math.round(total / byDay.size)
}

/**
 * Number of distinct calendar days that have at least one log entry.
 */
export function computeWeeklyLoggedDays(logs: MinimalLog[]): number {
  return buildLogDateSet(logs).size
}

/**
 * Progress toward the daily calorie goal, clamped to [0, 1].
 * Returns 0 if goal is 0 to avoid division by zero.
 */
export function computeCalorieRingPct(todayCalories: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(todayCalories / goal, 1)
}
