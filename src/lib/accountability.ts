/**
 * Accountability scores: a 1–10 score per meal and a 0–100 score per day,
 * worked out from the logged numbers and the user's goals (no AI call).
 * Scores are private — only ever shown to the meal's owner.
 */
import type { MealType } from './mealType'

export interface Goals { calories: number; protein: number; carbs: number; fat: number }

/** Daily targets — carbs/fat use the same 40% / 30% split shown on the plan screen. */
export function dailyGoals(calorieGoal: number | null | undefined, proteinGoal: number | null | undefined): Goals {
  const calories = calorieGoal || 2000
  return {
    calories,
    protein: proteinGoal || Math.round((calories * 0.25) / 4),
    carbs: Math.round((calories * 0.4) / 4),
    fat: Math.round((calories * 0.3) / 9),
  }
}

export interface ScoredMeal {
  id: string
  name: string | null
  meal_type: MealType
  created_at: string
  photo_url: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type Tone = 'good' | 'mid' | 'low'
export interface Reason { tone: Tone; text: string; hint?: string; short?: string }

/** Rough share of the day each meal should take. */
const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }

/** Everyday Indian protein top-ups, biggest first. */
const PROTEIN_FOODS: [string, number][] = [
  ['100 g paneer', 18],
  ['a cup of chana', 15],
  ['2 boiled eggs', 12],
  ['a bowl of curd', 10],
  ['a bowl of dal', 9],
]

/** One or two everyday foods that roughly cover a protein gap. */
export function proteinFix(gapG: number): string {
  const picks: [string, number][] = []
  let left = gapG
  for (const food of PROTEIN_FOODS) {
    if (picks.length === 2 || left <= 3) break
    if (food[1] <= left + 4) { picks.push(food); left -= food[1] }
  }
  if (!picks.length) picks.push(PROTEIN_FOODS[PROTEIN_FOODS.length - 1])
  return `${picks.map(([f]) => f).join(' + ')} ≈ ${picks.reduce((t, [, g]) => t + g, 0)} g`
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function mealScore(meal: ScoredMeal, goals: Goals): { score: number; tone: Tone; headline: string; reasons: Reason[] } {
  const share = MEAL_SHARE[meal.meal_type]
  const sizeRatio = meal.calories / (goals.calories * share)
  const proteinTarget = goals.protein * share
  const proteinRatio = proteinTarget ? meal.protein / proteinTarget : 1
  const macroKcal = meal.protein * 4 + meal.carbs * 4 + meal.fat * 9
  const carbShare = macroKcal ? (meal.carbs * 4) / macroKcal : 0
  const fatShare = macroKcal ? (meal.fat * 9) / macroKcal : 0
  const reasons: Reason[] = []
  const label = meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
  const dayShare = meal.calories / goals.calories

  // Size — 4 points. Small snacks are fine.
  let size: number
  if (sizeRatio >= 0.7 && sizeRatio <= 1.25) { size = 4; reasons.push({ tone: 'good', text: `Good size: ${pct(dayShare)} of your daily calories`, hint: `${label} budget ≈ ${pct(share)}` }) }
  else if (sizeRatio < 0.7) { size = meal.meal_type === 'snack' || sizeRatio >= 0.5 ? 3 : 2; reasons.push({ tone: size === 3 ? 'good' : 'mid', short: 'on the light side', text: `Light ${meal.meal_type}: ${pct(dayShare)} of your daily calories`, hint: `${label} budget ≈ ${pct(share)}` }) }
  else if (sizeRatio <= 1.5) { size = 2.5; reasons.push({ tone: 'mid', short: 'a bit big', text: `A bit big: ${pct(dayShare)} of your daily calories`, hint: `${label} budget ≈ ${pct(share)}` }) }
  else { size = 1; reasons.push({ tone: 'low', short: 'quite heavy', text: `Heavy: ${pct(dayShare)} of your daily calories in one meal`, hint: 'Go lighter on the next one' }) }

  // Protein — 4 points.
  const proteinGap = Math.round(proteinTarget - meal.protein)
  let protein: number
  if (proteinRatio >= 0.9) { protein = 4; reasons.unshift({ tone: 'good', text: `Good protein: ${Math.round(meal.protein)} g` }) }
  else {
    protein = proteinRatio >= 0.6 ? 2.5 : proteinRatio >= 0.3 ? 1 : 0
    reasons.push({ tone: protein >= 2.5 ? 'mid' : 'low', short: 'light on protein', text: `Protein ${Math.round(meal.protein)} g, about ${proteinGap} g under target for a ${meal.meal_type}`, hint: `Add ${proteinFix(proteinGap)}` })
  }

  // Balance — 2 points.
  let balance = 2
  if (!macroKcal) balance = 1
  else if (fatShare > 0.45) { balance = 0.5; reasons.push({ tone: 'mid', short: 'fat-heavy', text: `Fat-heavy: ${pct(fatShare)} of this meal's calories` }) }
  else if (carbShare > 0.65) { balance = 0.5; reasons.push({ tone: 'mid', short: 'carb-heavy', text: `Carb-heavy: ${pct(carbShare)} of this meal's calories` }) }

  const score = Math.min(10, Math.max(1, Math.round(size + protein + balance)))
  const tone: Tone = score >= 8 ? 'good' : score >= 6 ? 'mid' : 'low'
  // What went well first, then fixes; at most three lines.
  reasons.sort((a, b) => order(a.tone) - order(b.tone))
  const weakest = reasons.find((r) => r.tone !== 'good')?.short
  const headline = score >= 8 ? 'Great meal' : `${score >= 6 ? 'Decent' : 'Room to improve'}${weakest ? `, ${weakest}` : ''}`
  return { score, tone, headline, reasons: reasons.slice(0, 3) }
}
const order = (t: Tone) => (t === 'good' ? 0 : t === 'mid' ? 1 : 2)

export interface TargetRow { key: keyof Goals; label: string; planned: number; eaten: number; gap: number; tone: Tone }
export interface DayReview {
  score: number | null
  tone: Tone
  label: string
  summary: string
  rows: TargetRow[]
  missing: Reason[]
  meals: (ScoredMeal & { score: number; tone: Tone })[]
  /** Calories still available today (0 for past days). */
  roomKcal: number
}

/** Review of one day's meals against the goals. `isToday` softens "under" — the day isn't over. */
export function dayReview(meals: ScoredMeal[], goals: Goals, isToday: boolean): DayReview {
  const eaten = meals.reduce((t, m) => ({ calories: t.calories + m.calories, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  const ratio = (k: keyof Goals) => (goals[k] ? eaten[k] / goals[k] : 1)
  const off = (k: keyof Goals) => Math.abs(ratio(k) - 1)

  const rows: TargetRow[] = (['calories', 'protein', 'carbs', 'fat'] as const).map((key) => {
    const r = ratio(key)
    const tone: Tone = key === 'calories' ? (off(key) <= 0.1 ? 'good' : off(key) <= 0.2 ? 'mid' : 'low')
      : key === 'protein' ? (r >= 0.9 ? 'good' : r >= 0.7 ? 'mid' : 'low')
      : off(key) <= 0.2 ? 'good' : off(key) <= 0.35 ? 'mid' : 'low'
    return { key, label: key.charAt(0).toUpperCase() + key.slice(1), planned: goals[key], eaten: Math.round(eaten[key]), gap: Math.round(eaten[key] - goals[key]), tone }
  })
  const scored = meals.map((m) => { const s = mealScore(m, goals); return { ...m, score: s.score, tone: s.tone } })
  const roomKcal = isToday ? Math.max(0, Math.round(goals.calories - eaten.calories)) : 0

  if (!meals.length) {
    return { score: null, tone: 'low', label: isToday ? 'Nothing logged yet' : 'Nothing logged', summary: isToday ? 'Log a meal to see how today is going.' : 'No meals were logged this day.', rows, missing: [], meals: [], roomKcal }
  }

  // Calories 40 · protein 40 · meals logged 20.
  const cal = off('calories') <= 0.1 ? 40 : off('calories') <= 0.2 ? 25 : 10
  const pr = ratio('protein') >= 0.9 ? 40 : ratio('protein') >= 0.7 ? 25 : ratio('protein') >= 0.5 ? 15 : 5
  const mealPts = meals.length >= 3 ? 20 : meals.length === 2 ? 12 : 6
  const score = cal + pr + mealPts
  const tone: Tone = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low'
  const label = score === 100 ? 'Nailed it' : score >= 75 ? 'Mostly on track' : score >= 55 ? 'Getting there' : 'Off track'

  const calOk = off('calories') <= 0.1
  const proteinOk = ratio('protein') >= 0.9
  const summary = calOk && proteinOk ? 'Calories and protein both on target.'
    : calOk ? 'Calories were right, protein fell short.'
    : proteinOk ? `Protein was right, calories were ${eaten.calories > goals.calories ? 'over' : 'under'}.`
    : `Calories ${eaten.calories > goals.calories ? 'over' : 'under'} and protein short.`

  const missing: Reason[] = []
  const proteinGap = Math.round(goals.protein - eaten.protein)
  if (proteinGap > 5) missing.push({ tone: 'low', text: `${proteinGap} g protein short`, hint: proteinFix(proteinGap) })
  const calGap = Math.round(eaten.calories - goals.calories)
  if (calGap > goals.calories * 0.1) missing.push({ tone: 'low', text: `${calGap.toLocaleString()} kcal over`, hint: 'Keep the next meals lighter' })
  else if (calGap < -goals.calories * 0.1) missing.push(isToday
    ? { tone: 'mid', text: `${(-calGap).toLocaleString()} kcal left today`, hint: 'Room for one more meal' }
    : { tone: 'mid', text: `${(-calGap).toLocaleString()} kcal under`, hint: 'Eating too little can stall progress too' })
  else missing.push({ tone: 'good', text: 'Calories within range', hint: `${pct(ratio('calories'))} of goal` })
  const fatRow = rows.find((r) => r.key === 'fat')!
  if (fatRow.tone === 'low' && fatRow.gap > 0) missing.push({ tone: 'mid', text: `Fat ran high (+${fatRow.gap} g)`, hint: 'Go easy on oil, ghee and fried food' })
  if (proteinOk) missing.push({ tone: 'good', text: 'Protein target hit', hint: `${Math.round(eaten.protein)} of ${goals.protein} g` })

  return { score, tone, label, summary, rows, missing: missing.slice(0, 3), meals: scored, roomKcal }
}

/** Local midnight six days before `now` — the start of the last-7-days window. */
export function weekStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
}

/** The last 7 days (oldest first, today last), each day's meals bucketed by local date. */
export function mealsByDay(meals: ScoredMeal[], now = new Date()): ScoredMeal[][] {
  const start = weekStart(now)
  const days: ScoredMeal[][] = Array.from({ length: 7 }, () => [])
  for (const m of meals) {
    const at = new Date(m.created_at)
    const i = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000)
    if (i >= 0 && i <= 6) days[i].push(m)
  }
  for (const d of days) d.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return days
}

export function weekSummary(days: ScoredMeal[][], goals: Goals) {
  const reviews = days.map((d, i) => dayReview(d, goals, i === days.length - 1))
  const scored = reviews.filter((r) => r.score != null)
  return {
    scores: reviews.map((r) => r.score),
    avgScore: scored.length ? Math.round(scored.reduce((t, r) => t + r.score!, 0) / scored.length) : null,
    mealsPerDay: scored.length ? Math.round((scored.reduce((t, r) => t + r.meals.length, 0) / scored.length) * 10) / 10 : null,
    proteinHit: scored.filter((r) => r.rows[1].tone === 'good').length,
    daysOnTarget: scored.filter((r) => r.score! >= 80).length,
    daysLogged: scored.length,
  }
}
