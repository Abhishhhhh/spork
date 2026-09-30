/**
 * Weekly recap — last Monday–Sunday (the viewer's local time), plus the week
 * before it for comparison. Pure so it can be unit-tested; the hook feeds it
 * the viewer's own logs and like counts.
 */

export interface RecapLog {
  id: string
  name: string | null
  created_at: string
  calories: number | null
  protein: number | null
}

export interface WeeklyRecap {
  /** Local midnight, Monday of the recapped week. */
  weekStart: Date
  /** "22–28 Sep" / "29 Sep – 5 Oct" */
  label: string
  /** Mon..Sun — was anything logged that day? */
  days: boolean[]
  daysLogged: number
  meals: number
  /** Average kcal per LOGGED day (null if no calories were recorded). */
  avgCalories: number | null
  calorieGoal: number | null
  /** Days the protein goal was hit (null when there's no protein goal). */
  proteinDays: number | null
  proteinGoal: number | null
  /** avgCalories minus the previous week's average (null if either is missing). */
  calorieChange: number | null
  topMeal: { name: string; likes: number } | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Local midnight of the Monday that starts `date`'s week. */
export function mondayOf(date: Date): Date {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const sinceMonday = (midnight.getDay() + 6) % 7
  return new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - sinceMonday)
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** The complete week before the current one, and the week before that. */
export function recapWeeks(now = new Date()) {
  const thisMonday = mondayOf(now)
  return { lastStart: addDays(thisMonday, -7), prevStart: addDays(thisMonday, -14), end: thisMonday }
}

export function weekLabel(weekStart: Date): string {
  const sunday = addDays(weekStart, 6)
  // Fixed names: newer ICU writes "Sept", older "Sep" — keep labels stable.
  const month = (d: Date) => MONTHS[d.getMonth()]
  return weekStart.getMonth() === sunday.getMonth()
    ? `${weekStart.getDate()}–${sunday.getDate()} ${month(sunday)}`
    : `${weekStart.getDate()} ${month(weekStart)} – ${sunday.getDate()} ${month(sunday)}`
}

function dailyTotals(logs: RecapLog[], weekStart: Date) {
  const days = Array.from({ length: 7 }, () => ({ meals: 0, calories: 0, hasCalories: false, protein: 0 }))
  for (const log of logs) {
    const index = dayIndex(new Date(log.created_at), weekStart)
    if (index < 0 || index > 6) continue
    const day = days[index]
    day.meals++
    if (log.calories != null) { day.calories += log.calories; day.hasCalories = true }
    if (log.protein != null) day.protein += log.protein
  }
  return days
}

/** Whole local calendar days from weekStart to `at` (0 = Monday … 6 = Sunday). DST-safe. */
function dayIndex(at: Date, weekStart: Date): number {
  return Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())
    - Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())) / DAY_MS)
}

function averageCalories(days: ReturnType<typeof dailyTotals>): number | null {
  const withCalories = days.filter((d) => d.hasCalories)
  if (withCalories.length === 0) return null
  return Math.round(withCalories.reduce((sum, d) => sum + d.calories, 0) / withCalories.length)
}

/** null when nothing was logged last week — there's nothing to recap. */
export function buildWeeklyRecap(
  logs: RecapLog[],
  likesByLog: Map<string, number>,
  goals: { calorie_goal?: number | null; protein_goal?: number | null },
  now = new Date(),
): WeeklyRecap | null {
  const { lastStart, prevStart } = recapWeeks(now)
  const lastDays = dailyTotals(logs, lastStart)
  const meals = lastDays.reduce((sum, d) => sum + d.meals, 0)
  if (meals === 0) return null

  const avgCalories = averageCalories(lastDays)
  const prevAvg = averageCalories(dailyTotals(logs, prevStart))
  const proteinGoal = goals.protein_goal && goals.protein_goal > 0 ? goals.protein_goal : null

  let topMeal: WeeklyRecap['topMeal'] = null
  for (const log of logs) {
    const index = dayIndex(new Date(log.created_at), lastStart)
    const likes = likesByLog.get(log.id) ?? 0
    if (index < 0 || index > 6 || likes === 0) continue
    if (!topMeal || likes > topMeal.likes) topMeal = { name: log.name || 'A meal', likes }
  }

  return {
    weekStart: lastStart,
    label: weekLabel(lastStart),
    days: lastDays.map((d) => d.meals > 0),
    daysLogged: lastDays.filter((d) => d.meals > 0).length,
    meals,
    avgCalories,
    calorieGoal: goals.calorie_goal && goals.calorie_goal > 0 ? goals.calorie_goal : null,
    proteinDays: proteinGoal == null ? null : lastDays.filter((d) => d.meals > 0 && d.protein >= proteinGoal).length,
    proteinGoal,
    calorieChange: avgCalories != null && prevAvg != null ? avgCalories - prevAvg : null,
    topMeal,
  }
}

/** Mon–Wed: recent enough that "last week" still feels like news. */
export function isRecapSeason(now = new Date()): boolean {
  return (now.getDay() + 6) % 7 <= 2
}
