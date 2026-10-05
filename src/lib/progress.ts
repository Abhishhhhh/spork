/** Pure helpers behind the Insights progress cards (weight, BMI, streak week, calories by macro). */
import { mondayOf } from './weeklyRecap'

export interface WeighIn { weight_kg: number; logged_on: string }

// ── BMI ──────────────────────────────────────────────────────────────────────
export type BmiCategory = 'Underweight' | 'Healthy' | 'Overweight' | 'Obese'
const BMI_MIN = 15
const BMI_MAX = 40
/** Where the category boundaries sit on the 15–40 bar (for the gradient). */
export const BMI_STOPS = { healthy: (18.5 - BMI_MIN) / (BMI_MAX - BMI_MIN), overweight: (25 - BMI_MIN) / (BMI_MAX - BMI_MIN), obese: (30 - BMI_MIN) / (BMI_MAX - BMI_MIN) }

export function bmi(heightCm: number | null | undefined, weightKg: number | null | undefined) {
  if (!heightCm || !weightKg || heightCm < 90 || weightKg < 20) return null
  const value = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
  const category: BmiCategory = value < 18.5 ? 'Underweight' : value < 25 ? 'Healthy' : value < 30 ? 'Overweight' : 'Obese'
  const position = Math.min(1, Math.max(0, (value - BMI_MIN) / (BMI_MAX - BMI_MIN)))
  return { value, category, position }
}

// ── Weight ───────────────────────────────────────────────────────────────────
/** 0–1: how far from the first weigh-in to the goal (null without a usable goal). */
export function goalProgress(weighIns: WeighIn[], targetKg: number | null | undefined): number | null {
  if (!targetKg || weighIns.length === 0) return null
  const start = weighIns[0].weight_kg
  const current = weighIns[weighIns.length - 1].weight_kg
  if (start === targetKg) return current === targetKg ? 1 : 0
  return Math.min(1, Math.max(0, (start - current) / (start - targetKg)))
}

/** Days until the next weekly weigh-in (0 = due today). */
export function daysToNextWeighIn(weighIns: WeighIn[], now = new Date()): number {
  const last = weighIns[weighIns.length - 1]
  if (!last) return 0
  const [y, m, d] = last.logged_on.split('-').map(Number)
  const due = new Date(y, m - 1, d + 7)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((due.getTime() - today.getTime()) / 86_400_000))
}

export type WeightRange = 30 | 90 | 180 | 'all'
export function weighInsInRange(weighIns: WeighIn[], range: WeightRange, now = new Date()): WeighIn[] {
  if (range === 'all') return weighIns
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range)
  const fromKey = localDateKey(from)
  return weighIns.filter((w) => w.logged_on >= fromKey)
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Logs → week views ────────────────────────────────────────────────────────
export interface MacroLog {
  created_at: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

export interface MacroDay {
  calories: number
  /** Share of the day's macro calories (0–1 each; all 0 if no macros were recorded). */
  protein: number
  carbs: number
  fat: number
}

/** 7 days (Mon–Sun) of calories, each split by macro share, for the week `weeksAgo` before this one. */
export function caloriesByMacro(logs: MacroLog[], weeksAgo: number, now = new Date()): MacroDay[] {
  const start = mondayOf(now)
  start.setDate(start.getDate() - 7 * weeksAgo)
  const days = Array.from({ length: 7 }, () => ({ calories: 0, p: 0, c: 0, f: 0 }))
  for (const log of logs) {
    const at = new Date(log.created_at)
    const i = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000)
    if (i < 0 || i > 6) continue
    days[i].calories += log.calories ?? 0
    days[i].p += (log.protein ?? 0) * 4
    days[i].c += (log.carbs ?? 0) * 4
    days[i].f += (log.fat ?? 0) * 9
  }
  return days.map(({ calories, p, c, f }) => {
    const total = p + c + f
    return { calories: Math.round(calories), protein: total ? p / total : 0, carbs: total ? c / total : 0, fat: total ? f / total : 0 }
  })
}

/** Mon–Sun of the current week: logged that day? Plus today's index. */
export function thisWeekDots(logDates: string[], now = new Date()): { days: boolean[]; today: number } {
  const start = mondayOf(now)
  const days = Array<boolean>(7).fill(false)
  for (const iso of logDates) {
    const at = new Date(iso)
    const i = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000)
    if (i >= 0 && i <= 6) days[i] = true
  }
  return { days, today: (now.getDay() + 6) % 7 }
}
