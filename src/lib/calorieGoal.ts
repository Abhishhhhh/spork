export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface CalorieGoalInputs {
  weightKg: number
  heightCm: number
  age: number
  activityLevel: ActivityLevel
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/**
 * Suggests a daily calorie goal using the Mifflin-St Jeor BMR formula.
 * Mifflin-St Jeor requires a biological-sex constant (+5 for men, -161 for
 * women); since this app doesn't collect that field, we use the midpoint
 * (-78) as a sex-neutral approximation. The result is always presented as
 * an editable suggestion, never a fixed requirement.
 */
export function suggestCalorieGoal(inputs: CalorieGoalInputs): number {
  const { weightKg, heightCm, age, activityLevel } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(tdee / 10) * 10
}
