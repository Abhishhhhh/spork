export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Sex = 'male' | 'female'

export interface CalorieGoalInputs {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
  activityLevel: ActivityLevel
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const SEX_CONSTANTS: Record<Sex, number> = {
  male: 5,
  female: -161,
}

/**
 * Suggests a daily calorie goal using the exact Mifflin-St Jeor BMR formula:
 * BMR = 10*weightKg + 6.25*heightCm - 5*age + (5 for male, -161 for female).
 * The result is always presented as an editable suggestion, never a fixed
 * requirement.
 */
export function suggestCalorieGoal(inputs: CalorieGoalInputs): number {
  const { weightKg, heightCm, age, sex, activityLevel } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANTS[sex]
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(tdee / 10) * 10
}
