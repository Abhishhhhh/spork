import type { Database } from './database.types'

type Log = Partial<Database['public']['Tables']['logs']['Row']>
type Goals = { calorie_goal?: number | null; protein_goal?: number | null }
export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat'] as const
export type Nutrient = typeof nutrientKeys[number]
const validTarget = (value?: number | null) => value != null && Number.isFinite(value) && value > 0 ? value : null

export function aggregateToday(logs: Log[], goals: Goals = {}) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const missing = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  for (const log of logs) {
    const values = { calories: log.calories_final ?? log.calories_estimate, protein: log.protein_final_g ?? log.protein_estimate_g, carbs: log.carbs_final_g ?? log.carbs_estimate_g, fat: log.fat_final_g ?? log.fat_estimate_g }
    for (const key of nutrientKeys) {
      const value = values[key]
      if (value == null || !Number.isFinite(value) || value < 0) missing[key]++
      else totals[key] += value
    }
  }
  const targets = { calories: validTarget(goals.calorie_goal), protein: validTarget(goals.protein_goal), carbs: null, fat: null }
  return { totals, missing, targets, caloriesLogged: totals.calories, proteinLogged: totals.protein, carbsLogged: totals.carbs, fatLogged: totals.fat,
    // Legacy numeric fields: zero means absent, not a dietary target. Use targets for display.
    calorieGoal: targets.calories ?? 0, proteinGoal: targets.protein ?? 0,
    remaining: targets.calories == null ? 0 : targets.calories - totals.calories,
    percentUsed: targets.calories == null ? 0 : Math.min(Math.round(totals.calories / targets.calories * 100), 100), logCount: logs.length }
}
export function localDayBounds(now = new Date()) {
  return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString() }
}
export function completionMessage(totalLogs: number | null, confirmedStreak: number | null, firstToday: boolean) {
  if (totalLogs === 1) return 'Your first meal is saved'
  if (firstToday && confirmedStreak != null && [7, 30, 100].includes(confirmedStreak)) return `${confirmedStreak} days of checking in`
  return 'Meal saved'
}
export type TodayProgress = ReturnType<typeof aggregateToday>
export function nutrientStatus(consumed: number, target: number | null, unit: string) {
  if (target == null) return 'No target set'
  const difference = target - consumed
  return difference > 0 ? `${difference.toLocaleString()} ${unit} remaining` : difference < 0 ? `${Math.abs(difference).toLocaleString()} ${unit} over target` : 'At target'
}
