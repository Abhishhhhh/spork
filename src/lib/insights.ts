/**
 * Insights — pure derivation of the analytics screens from daily aggregates.
 *
 * Two data sources feed the same shape:
 *   • the `get_insights` Postgres RPC (supabase/migrations/0009_insights.sql)
 *   • a client-side fallback that aggregates the user's own `logs` rows
 * Both produce `DailyRow[]` + `TopProteinMeal[]`; everything shown on screen
 * comes out of `deriveInsights()` below, so the numbers can't drift between
 * the two paths. No React, no Supabase in this file — it is unit-tested.
 */
import type { MealType } from './mealType'

export type InsightRange = 7 | 30 | 90
export const CONSISTENCY_DAYS = 28
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

export interface MealTypeTotals { calories: number; protein: number; count: number }

/** One local calendar day of a user's logging. */
export interface DailyRow {
  date: string                       // yyyy-mm-dd (user's local tz)
  calories: number
  protein: number
  carbs: number
  fat: number
  meals: number
  byType: Record<MealType, MealTypeTotals>
  breakfastBefore1030: boolean       // any breakfast logged before 10:30 local
}

export interface TopProteinMeal { name: string; count: number; avgProtein: number }

export interface InsightGoals { calorieGoal: number; proteinGoal: number }

/** Minimal log shape needed for the client-side fallback aggregation. */
export interface InsightLog {
  created_at: string
  name: string | null
  meal_type: MealType
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateFromKey(key: string): Date { return new Date(key + 'T12:00:00') }

const DAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAME    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function emptyByType(): Record<MealType, MealTypeTotals> {
  return { breakfast: { calories: 0, protein: 0, count: 0 }, lunch: { calories: 0, protein: 0, count: 0 }, dinner: { calories: 0, protein: 0, count: 0 }, snack: { calories: 0, protein: 0, count: 0 } }
}

function round(n: number, dp = 0): number { const f = 10 ** dp; return Math.round(n * f) / f }
function avg(nums: number[]): number { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0 }
function fmt(n: number): string { return Math.round(n).toLocaleString() }

/** Last `days` local dates ending today, oldest first. */
export function dateWindow(days: number, today = new Date()): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    out.push(localDateKey(d))
  }
  return out
}

// ── Client-side fallback aggregation ─────────────────────────────────────────

/** Groups raw logs into DailyRow[] (only days that have logs). */
export function aggregateLogsToDaily(logs: InsightLog[]): DailyRow[] {
  const byDate = new Map<string, DailyRow>()
  for (const log of logs) {
    const d = new Date(log.created_at)
    const key = localDateKey(d)
    let row = byDate.get(key)
    if (!row) {
      row = { date: key, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0, byType: emptyByType(), breakfastBefore1030: false }
      byDate.set(key, row)
    }
    const kcal = log.calories ?? 0, prot = log.protein ?? 0
    row.calories += kcal
    row.protein  += prot
    row.carbs    += log.carbs ?? 0
    row.fat      += log.fat ?? 0
    row.meals    += 1
    const t = row.byType[log.meal_type] ?? row.byType.snack
    t.calories += kcal; t.protein += prot; t.count += 1
    if (log.meal_type === 'breakfast' && (d.getHours() < 10 || (d.getHours() === 10 && d.getMinutes() < 30))) row.breakfastBefore1030 = true
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Top protein meals by name from raw logs (client fallback). */
export function topProteinMealsFromLogs(logs: InsightLog[], limit = 3): TopProteinMeal[] {
  const groups = new Map<string, { name: string; count: number; total: number }>()
  for (const log of logs) {
    if (!log.name || log.protein == null) continue
    const key = log.name.trim().toLowerCase()
    const g = groups.get(key) ?? { name: log.name.trim(), count: 0, total: 0 }
    g.count += 1; g.total += log.protein
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({ name: g.name, count: g.count, avgProtein: round(g.total / g.count) }))
    .sort((a, b) => b.avgProtein - a.avgProtein || b.count - a.count)
    .slice(0, limit)
}

// ── Derived model ────────────────────────────────────────────────────────────

export interface InsightCard { mark: string; tone: 'teal' | 'pink' | 'ink'; title: string; body: string }
export interface Bar { label: string; pct: number; over: boolean; date?: string }
export interface MacroStat { avg: number; goal: number; pct: number }

export interface Insights {
  range: { days: InsightRange; from: string; to: string; label: string; enough: boolean }
  overview: {
    avgCalories: number; deltaToGoal: number
    onTargetDays: number; proteinGoalDays: number; loggedDays: number
    bars: Bar[]; cards: InsightCard[]
  }
  calories: {
    avg: number; onTargetDays: number; deltaToGoal: number; bars: Bar[]
    byMeal: { type: MealType; label: string; pct: number }[]
    card: InsightCard | null
  }
  macros: {
    protein: MacroStat; carbs: MacroStat; fat: MacroStat
    series: { label: string; value: number }[]
    shortfall: number; callout: { title: string; body: string }
    topProtein: TopProteinMeal[]
  }
  consistency: {
    days: number; from: string; to: string
    loggedDays: number; streak: number; mealsTotal: number
    calendar: { date: string; state: 'complete' | 'partial' | 'missed' }[]
    habits: { breakfastPct: number; lunchPct: number; dinnerPct: number; dinnerWeekendMissPct: number }
    card: InsightCard
  }
}

export interface DeriveInput {
  daily: DailyRow[]            // any window; must cover at least the last 2×range days for comparisons
  topProtein: TopProteinMeal[]
  goals: InsightGoals
  range: InsightRange
  streak: number
  today?: Date
}

function fmtRange(from: string, to: string): string {
  const f = dateFromKey(from), t = dateFromKey(to)
  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${f.toLocaleDateString(undefined, opt)} – ${t.toLocaleDateString(undefined, opt)}`
}

function onTarget(row: DailyRow, goal: number): boolean {
  return goal > 0 && Math.abs(row.calories - goal) <= goal * 0.1
}

export function deriveInsights(input: DeriveInput): Insights {
  const today = input.today ?? new Date()
  const { goals, range } = input
  const calorieGoal = goals.calorieGoal > 0 ? goals.calorieGoal : 2000
  const proteinGoal = goals.proteinGoal
  const carbsGoal   = Math.round((calorieGoal * 0.4) / 4)
  const fatGoal     = Math.round((calorieGoal * 0.3) / 9)

  const byDate = new Map(input.daily.map((r) => [r.date, r]))
  const window = dateWindow(range, today)
  const rows   = window.map((d) => byDate.get(d)).filter((r): r is DailyRow => Boolean(r))
  const logged = rows.filter((r) => r.meals > 0)
  const enough = logged.length >= 3

  // ── Calories ──────────────────────────────────────────────────────────
  const avgCalories  = round(avg(logged.map((r) => r.calories)))
  const deltaToGoal  = calorieGoal - avgCalories               // +ve = under target
  const onTargetDays = logged.filter((r) => onTarget(r, calorieGoal)).length
  const proteinDays  = proteinGoal > 0 ? logged.filter((r) => r.protein >= proteinGoal).length : 0

  // Bars: 7-day range → each actual day; longer → weekday averages Mon..Sun
  let bars: Bar[]
  if (range === 7) {
    bars = window.map((d) => {
      const r = byDate.get(d)
      const pct = r ? round((r.calories / calorieGoal) * 100) : 0
      return { label: DAY_INITIAL[dateFromKey(d).getDay()], pct, over: pct > 100, date: d }
    })
  } else {
    const buckets: number[][] = [[], [], [], [], [], [], []]
    for (const r of logged) buckets[dateFromKey(r.date).getDay()].push(r.calories)
    const order = [1, 2, 3, 4, 5, 6, 0]
    bars = order.map((dow) => {
      const pct = buckets[dow].length ? round((avg(buckets[dow]) / calorieGoal) * 100) : 0
      return { label: DAY_INITIAL[dow], pct, over: pct > 100 }
    })
  }

  // Calories by meal type share
  const typeTotals = emptyByType()
  for (const r of logged) for (const t of MEAL_TYPES) {
    typeTotals[t].calories += r.byType[t].calories
    typeTotals[t].protein  += r.byType[t].protein
    typeTotals[t].count    += r.byType[t].count
  }
  const totalKcal = MEAL_TYPES.reduce((s, t) => s + typeTotals[t].calories, 0)
  const byMeal = MEAL_TYPES.map((t) => ({ type: t, label: MEAL_LABELS[t], pct: totalKcal ? round((typeTotals[t].calories / totalKcal) * 100) : 0 }))

  // ── Insight cards ─────────────────────────────────────────────────────
  const cards: InsightCard[] = []

  // 1. Weekday vs weekend adherence (mean absolute distance to goal)
  const wk = logged.filter((r) => { const d = dateFromKey(r.date).getDay(); return d >= 1 && d <= 5 })
  const we = logged.filter((r) => { const d = dateFromKey(r.date).getDay(); return d === 0 || d === 6 })
  if (wk.length >= 2 && we.length >= 1) {
    const dist = (rs: DailyRow[]) => avg(rs.map((r) => Math.abs(r.calories - calorieGoal)))
    const weekdaysBetter = dist(wk) <= dist(we)
    cards.push({
      mark: '↗', tone: 'teal',
      title: weekdaysBetter ? 'Weekdays are your strongest days' : 'Weekends are your strongest days',
      body: weekdaysBetter
        ? 'You stay closest to your calorie target from Monday to Friday'
        : 'You stay closest to your calorie target on Saturday and Sunday',
    })
  }

  // 2. Protein by meal type
  const totalProt = MEAL_TYPES.reduce((s, t) => s + typeTotals[t].protein, 0)
  if (totalProt > 0) {
    const best = [...MEAL_TYPES].sort((a, b) => typeTotals[b].protein - typeTotals[a].protein)[0]
    const share = round((typeTotals[best].protein / totalProt) * 100)
    cards.push({
      mark: '●', tone: 'pink',
      title: `Protein is most consistent at ${MEAL_LABELS[best].toLowerCase()}`,
      body: `${MEAL_LABELS[best]} contributes ${share}% of your daily protein on average`,
    })
  }

  // 3. Highest weekday (calories screen)
  let caloriesCard: InsightCard | null = null
  if (logged.length >= 3) {
    const dowKcal: number[][] = [[], [], [], [], [], [], []]
    const dowDinner: number[][] = [[], [], [], [], [], [], []]
    for (const r of logged) { const d = dateFromKey(r.date).getDay(); dowKcal[d].push(r.calories); dowDinner[d].push(r.byType.dinner.calories) }
    const withData = dowKcal.map((v, i) => ({ i, a: v.length ? avg(v) : -1 })).filter((x) => x.a >= 0)
    if (withData.length >= 2) {
      const top = withData.sort((a, b) => b.a - a.a)[0]
      const allDinner = avg(logged.map((r) => r.byType.dinner.calories))
      const topDinner = avg(dowDinner[top.i])
      const dinnerDiff = Math.round(topDinner - allDinner)
      caloriesCard = {
        mark: '⌁', tone: 'teal',
        title: `${DAY_NAME[top.i]} runs highest`,
        body: dinnerDiff > 30
          ? `Dinner adds around ${fmt(dinnerDiff)} kcal more than your ${range === 7 ? 'weekly' : 'usual'} dinner average`
          : `${DAY_NAME[top.i]} averages ${fmt(top.a - avgCalories)} kcal above your other days`,
      }
    }
  }

  // ── Macros ────────────────────────────────────────────────────────────
  const avgProtein = round(avg(logged.map((r) => r.protein)))
  const avgCarbs   = round(avg(logged.map((r) => r.carbs)))
  const avgFat     = round(avg(logged.map((r) => r.fat)))
  const macro = (a: number, g: number): MacroStat => ({ avg: a, goal: g, pct: g > 0 ? Math.min(round((a / g) * 100), 100) : 0 })

  // Protein series: 7 → last 7 days; else weekday averages
  let series: { label: string; value: number }[]
  if (range === 7) {
    series = window.map((d) => ({ label: DAY_INITIAL[dateFromKey(d).getDay()], value: round(byDate.get(d)?.protein ?? 0) }))
  } else {
    const b: number[][] = [[], [], [], [], [], [], []]
    for (const r of logged) b[dateFromKey(r.date).getDay()].push(r.protein)
    series = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({ label: DAY_INITIAL[dow], value: b[dow].length ? round(avg(b[dow])) : 0 }))
  }

  const shortfall = proteinGoal > 0 ? Math.max(round(proteinGoal - avgProtein), 0) : 0
  // Meal with the lowest protein contribution relative to an even split
  const weakest = [...MEAL_TYPES].filter((t) => typeTotals[t].count > 0).sort((a, b) => typeTotals[a].protein - typeTotals[b].protein)[0]
  const weakestAvg = weakest ? round(typeTotals[weakest].protein / Math.max(typeTotals[weakest].count, 1)) : 0
  const callout = proteinGoal <= 0
    ? { title: 'Set a protein goal to track this', body: 'Add a daily protein target in Settings and this screen will show your gap and best sources' }
    : shortfall === 0
    ? { title: 'You’re hitting your protein goal', body: `Averaging ${avgProtein}g against a ${proteinGoal}g target — keep the pattern going` }
    : {
        title: `${shortfall}g short on average`,
        body: weakest
          ? `${MEAL_LABELS[weakest]} is your lightest protein meal at about ${weakestAvg}g — the easiest place to close the gap`
          : 'Log a few more meals to see where the gap comes from',
      }

  // ── Consistency (fixed 28-day window + previous 28 for comparison) ────
  const cWindow  = dateWindow(CONSISTENCY_DAYS, today)
  const prevEnd  = new Date(today.getFullYear(), today.getMonth(), today.getDate() - CONSISTENCY_DAYS)
  const pWindow  = dateWindow(CONSISTENCY_DAYS, prevEnd)
  const stateOf  = (r: DailyRow | undefined): 'complete' | 'partial' | 'missed' =>
    !r || r.meals === 0 ? 'missed' : r.meals >= 3 ? 'complete' : 'partial'
  const calendar = cWindow.map((d) => ({ date: d, state: stateOf(byDate.get(d)) }))
  const cRows    = cWindow.map((d) => byDate.get(d)).filter((r): r is DailyRow => r !== undefined && r.meals > 0)
  const cComplete = calendar.filter((c) => c.state === 'complete').length
  const pComplete = pWindow.filter((d) => stateOf(byDate.get(d)) === 'complete').length
  const pLogged   = pWindow.filter((d) => (byDate.get(d)?.meals ?? 0) > 0).length

  const pctOf = (n: number, of: number) => (of ? round((n / of) * 100) : 0)
  const habits = {
    breakfastPct: pctOf(cRows.filter((r) => r.breakfastBefore1030).length, cRows.length),
    lunchPct:     pctOf(cRows.filter((r) => r.byType.lunch.count > 0).length, cRows.length),
    dinnerPct:    pctOf(cRows.filter((r) => r.byType.dinner.count > 0).length, cRows.length),
    dinnerWeekendMissPct: (() => {
      const weekend = cRows.filter((r) => { const d = dateFromKey(r.date).getDay(); return d === 0 || d === 6 })
      return pctOf(weekend.filter((r) => r.byType.dinner.count === 0).length, weekend.length)
    })(),
  }
  const diff = cComplete - pComplete
  const consistencyCard: InsightCard = pLogged === 0
    ? { mark: '✓', tone: 'teal', title: cRows.length ? 'Your first month of logging' : 'Start your logging habit', body: cRows.length ? `${cRows.length} days logged so far — keep going to unlock comparisons` : 'Log a meal today to start building your history' }
    : diff > 0
    ? { mark: '✓', tone: 'teal', title: 'Consistency is improving', body: `You logged ${diff} more complete day${diff === 1 ? '' : 's'} than the previous 28-day period` }
    : diff < 0
    ? { mark: '↘', tone: 'ink', title: 'Consistency dipped a little', body: `${Math.abs(diff)} fewer complete day${diff === -1 ? '' : 's'} than the previous 28-day period` }
    : { mark: '✓', tone: 'teal', title: 'Steady as it goes', body: 'Same number of complete days as the previous 28-day period' }

  return {
    range: { days: range, from: window[0], to: window[window.length - 1], label: fmtRange(window[0], window[window.length - 1]), enough },
    overview: { avgCalories, deltaToGoal, onTargetDays, proteinGoalDays: proteinDays, loggedDays: logged.length, bars, cards: cards.slice(0, 2) },
    calories: { avg: avgCalories, onTargetDays, deltaToGoal, bars, byMeal, card: caloriesCard },
    macros: {
      protein: macro(avgProtein, proteinGoal), carbs: macro(avgCarbs, carbsGoal), fat: macro(avgFat, fatGoal),
      series, shortfall, callout, topProtein: input.topProtein,
    },
    consistency: {
      days: CONSISTENCY_DAYS, from: cWindow[0], to: cWindow[cWindow.length - 1],
      loggedDays: cRows.length, streak: input.streak, mealsTotal: cRows.reduce((s, r) => s + r.meals, 0),
      calendar, habits, card: consistencyCard,
    },
  }
}
